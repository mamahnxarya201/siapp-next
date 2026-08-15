function abortError(reason) { const error = new Error(typeof reason === 'string' ? reason : 'The scheduled operation was cancelled.'); error.name='AbortError'; error.reason=reason; return error; }

export class ScheduledJob {
  constructor(cancelWork, onFinished) { this.cancelWork=cancelWork; this.onFinished=onFinished; this.cancelled=false; this.completed=false; }
  cancel(reason='The scheduled callback was cancelled.') { if (this.completed) return false; this.cancelled=true; this.cancelWork(reason); this.finish(); return true; }
  run(callback, value) { if (this.completed) return false; try { callback(value); } finally { this.finish(); } return true; }
  finish() { if (this.completed) return; this.completed=true; this.onFinished(this); }
  get isCancelled() { return this.cancelled; } get isCompleted() { return this.completed; }
}

export class AsyncJob {
  constructor(operation, queueMicrotask, onFinished) {
    if (typeof operation !== 'function') throw new TypeError('An asynchronous job requires an operation function.');
    this.controller=new AbortController(); this.completed=false; this.cancelled=false; this.onFinished=onFinished;
    this.promise=new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;});
    this.controller.signal.addEventListener('abort',()=>{this.cancelled=true;this.settleRejected(abortError(this.controller.signal.reason));},{once:true});
    queueMicrotask(async()=>{ if(this.completed)return; try { const result=await operation(this.controller.signal); if(!this.controller.signal.aborted)this.settleResolved(result); } catch(error){if(!this.completed)this.settleRejected(error);} });
  }
  cancel(reason='The asynchronous job was cancelled.') { if(this.completed)return false; this.controller.abort(reason); return true; }
  settleResolved(value){if(this.completed)return;this.completed=true;this.resolve(value);this.onFinished(this);}
  settleRejected(error){if(this.completed)return;this.completed=true;this.reject(error);this.onFinished(this);}
  get signal(){return this.controller.signal;} get isCancelled(){return this.cancelled;} get isCompleted(){return this.completed;}
}

export class Scheduler {
  constructor(environment={}) {
    this.jobs=new Set();
    this.queue=environment.queueMicrotask ?? ((callback)=>Promise.resolve().then(callback));
    this.requestFrame=environment.requestAnimationFrame ?? (typeof globalThis.requestAnimationFrame==='function' ? (callback)=>globalThis.requestAnimationFrame(callback) : null);
    this.cancelFrame=environment.cancelAnimationFrame ?? (typeof globalThis.cancelAnimationFrame==='function' ? (handle)=>globalThis.cancelAnimationFrame(handle) : null);
    this.setTimer=environment.setTimeout ?? ((callback,delay)=>setTimeout(callback,delay));
    this.clearTimer=environment.clearTimeout ?? ((handle)=>clearTimeout(handle));
    this.now=environment.now ?? (()=>Date.now());
  }
  createScheduled(cancelWork){const job=new ScheduledJob(cancelWork,(finished)=>this.jobs.delete(finished));this.jobs.add(job);return job;}
  scheduleMicrotask(callback){if(typeof callback!=='function')throw new TypeError('A microtask callback must be a function.');const job=this.createScheduled(()=>{});this.queue(()=>job.run(callback));return job;}
  scheduleAnimationFrame(callback){
    if(typeof callback!=='function')throw new TypeError('An animation-frame callback must be a function.');
    let handle; let cancel;
    const job=this.createScheduled(()=>cancel?.());
    if(this.requestFrame&&this.cancelFrame){handle=this.requestFrame((timestamp)=>job.run(callback,timestamp));cancel=()=>this.cancelFrame(handle);}
    else {handle=this.setTimer(()=>job.run(callback,this.now()),16);cancel=()=>this.clearTimer(handle);}
    return job;
  }
  scheduleDelay(callback,delayMs){
    if(typeof callback!=='function')throw new TypeError('A delayed callback must be a function.');
    if(!Number.isFinite(delayMs)||delayMs<0)throw new RangeError('A delay must be a finite non-negative number.');
    let handle; const job=this.createScheduled(()=>this.clearTimer(handle)); handle=this.setTimer(()=>job.run(callback,this.now()),delayMs); return job;
  }
  scheduleAsync(operation){const job=new AsyncJob(operation,this.queue,(finished)=>this.jobs.delete(finished));this.jobs.add(job);return job;}
  cancelAll(reason='All scheduled work was cancelled.'){const jobs=[...this.jobs];for(const job of jobs)job.cancel(reason);return jobs.length;}
  get activeJobCount(){return this.jobs.size;}
}
