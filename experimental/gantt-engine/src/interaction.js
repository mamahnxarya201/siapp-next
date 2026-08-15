import { applyForwardOnlyScheduleChange, calculateDraggedTaskDates } from './scheduling.js';
import { snapIncrementUnits } from './timeline.js';

const closestTask=(target,root)=>{const el=target instanceof Element?target.closest('[data-task-id]'):null;return el&&root.contains(el)?el:null;};

export class GanttInteractionController {
  constructor({root,scheduler,getState,onSelect,onHover,onPreview,onCommit,onNotice=()=>{}}){
    this.root=root;this.scheduler=scheduler;this.getState=getState;this.onSelect=onSelect;this.onHover=onHover;this.onPreview=onPreview;this.onCommit=onCommit;this.onNotice=onNotice;this.active=null;this.frame=null;this.started=false;this.verticalNoticeShown=false;
    this.listeners={pointerdown:e=>this.down(e),pointerover:e=>this.over(e),pointerout:e=>this.out(e),keydown:e=>this.key(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:()=>this.cancel('Pointer interaction cancelled.'),blur:()=>this.cancel('Window focus was lost.')};
  }
  start(){if(this.started)return false;for(const type of['pointerdown','pointerover','pointerout','keydown'])this.root.addEventListener(type,this.listeners[type]);for(const type of['pointermove','pointerup','pointercancel','blur'])window.addEventListener(type,this.listeners[type]);this.started=true;return true;}
  stop(){if(!this.started)return false;this.cancel();for(const type of['pointerdown','pointerover','pointerout','keydown'])this.root.removeEventListener(type,this.listeners[type]);for(const type of['pointermove','pointerup','pointercancel','blur'])window.removeEventListener(type,this.listeners[type]);this.started=false;return true;}
  down(event){
    if(event.defaultPrevented||event.button!==0)return;const taskElement=closestTask(event.target,this.root);if(!taskElement)return;const state=this.getState();if(state.connection||state.connectionLock)return;const task=state.tasks.find(item=>item.id===taskElement.dataset.taskId);if(!task)return;
    const interactionElement=event.target instanceof Element?event.target.closest('[data-interaction-mode]'):null;const mode=interactionElement&&taskElement.contains(interactionElement)?interactionElement.dataset.interactionMode:'move';event.preventDefault();this.onSelect(task.id);this.verticalNoticeShown=false;
    this.active={taskId:task.id,mode,startClientX:event.clientX,startClientY:event.clientY,pendingClientX:event.clientX,tasks:state.tasks,scale:state.scale,snapIncrement:state.snapIncrement,visibleWeekdays:state.visibleWeekdays};taskElement.setPointerCapture?.(event.pointerId);
  }
  move(event){if(!this.active)return;this.active.pendingClientX=event.clientX;if(!this.verticalNoticeShown&&Math.abs(event.clientY-this.active.startClientY)>8){this.verticalNoticeShown=true;this.onNotice('Task bars move horizontally by schedule date.');}if(this.frame)return;this.frame=this.scheduler.scheduleAnimationFrame(()=>{this.frame=null;this.preview();});}
  preview(){if(!this.active)return null;const drag=this.active;const update=calculateDraggedTaskDates({tasks:drag.tasks,taskId:drag.taskId,mode:drag.mode,pixelDelta:drag.pendingClientX-drag.startClientX,scale:drag.scale,snapIncrement:drag.snapIncrement,visibleWeekdays:drag.visibleWeekdays});const result=applyForwardOnlyScheduleChange(drag.tasks,drag.taskId,update,{mode:drag.mode,minimumDurationUnits:snapIncrementUnits(drag.snapIncrement)});this.onPreview(result);return result;}
  up(event){if(!this.active)return;this.active.pendingClientX=event.clientX;this.frame?.cancel();this.frame=null;const result=this.preview();this.active=null;if(result)this.onCommit(result);}
  over(event){if(this.active)return;const task=closestTask(event.target,this.root),related=closestTask(event.relatedTarget,this.root);if(task&&task.dataset.taskId!==related?.dataset.taskId)this.onHover(task.dataset.taskId);}
  out(event){if(this.active)return;const task=closestTask(event.target,this.root),related=closestTask(event.relatedTarget,this.root);if(task&&task.dataset.taskId!==related?.dataset.taskId)this.onHover(null);}
  key(event){if(event.key==='Escape'&&this.active){event.preventDefault();this.cancel('Interaction cancelled.');return;}if(!['Enter',' '].includes(event.key))return;const task=closestTask(event.target,this.root);if(task){event.preventDefault();this.onSelect(task.dataset.taskId);}}
  cancel(notice){this.frame?.cancel();this.frame=null;if(!this.active)return false;this.active=null;this.onPreview(null);if(notice)this.onNotice(notice);return true;}
}
