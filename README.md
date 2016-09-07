# phabricator-snooze-demo

~~UserScript that adds snoozing of tasks and audits on Phabricator dashboard using local Browser storage.~~

**AWESOME INBOX ZERO FOR PHABRICATOR! MUCH STABLE!!!**

# Why?

We know the Inbox Zero concept; it is great.
We know Google Inbox; it is great.
We know Phabricator; it is great -- however it lacks support for snoozing.

This UserScript gives us Inbox Zero in Phabricator today.
With this UserScript everyone can see that Inbox Zero in Phabricator is technically possible and that is absolutely awesome!

PS: We also hope that someone adds multi-device support to this demo because we are lazy but do not want to miss that feature.

# Installation

* Install [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) for Chrome or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/) for Firefox so you can run UserScripts.
* Add the phabricator-snooze-demo UserScript from:
 * https://raw.githubusercontent.com/jcbachmann/phabricator-snooze-demo/master/phabricator-snooze-demo.js
* If you know how to hack the internet you can change line 7 (`// @match        https://secure.phabricator.com/`) to also match your own phabricator instance.

# Screenshots

There are lots of tasks on your dashboard. You can no longer focus. There is nothing you can do.
![pre](doc/pre.png?raw=true "pre")

There is something you can do: You snooze all of the tasks!
![snooze](doc/snooze.png?raw=true "snooze")

Now you can focus once again and get work done!
PS: Works much better if you use a Dashboard that includes a "Assigned to me" list.
![snoozed](doc/snoozed.png?raw=true "snoozed")

You can show snoozed tasks again by clicking the clock icon in the top left.
PS: Don't do it. Looks awful and those tasks are hidden for good reason! 
![hidden](doc/hidden.png?raw=true "hidden")

To un-snooze a task, simply set the snooze date to a date in the past.

# License

// note to self: add license info here
