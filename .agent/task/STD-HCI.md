# Must

all form and popup that can be interacted with user must follow standart keyboard navigation which is:
- Tab able 
	- when user press tab on their keyboard it should jump on next field on that form in ascending order
	- when the selected field reaching the ends it should placed on the next action which is, by order:
		- Accept
		- Decline
		- Draft (if exists)
	- if user choose to press tab again therefore the next selected tab was the first field, therefore creating a loop. DO NOT jump to other UI or native browser control

- Accept/Decline button position
	- by default following the standart software HCI, "Positive/Accept/Yes" will be on the left side and the "Negative/Decline/No/Cancel" will be on the right side. but for some action those layout must be switched, for example:
		- Delete Popup
		the rule for switching is if that pop up is destructive and requires user cognitive (re triggering their attention hook) it should be switched

- Early Optimization
	- is the root of evil. unless it was the core feature that user spends their time a lot. if the optimization already there before you come, please leave untouched
	- optimize all the codebase with the standart that both me and you as an agent acknowledge, if the optimization standart or guide doesnt exists yet, STOP ALL WORK AND TELL THE PROMPTER TO DEFINE OR DISCUSS, ALWAYS ASK CLOSE ENDED QUESTION ON THIS. any optimization that i require by talking directly without refering .md files always superseeded the .md files optimization
	- Hacky optimization is okay as long as the user of this project (PMIS) feels the application fast and snappy. always optimize for the snappy
	- Write optimization task after the core task already done. and if you failed to optimize please STOP ALL WORK and report back