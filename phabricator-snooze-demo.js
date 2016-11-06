// ==UserScript==
// @name         Phabricator Snooze Demo
// @namespace    https://www.jcbachmann.com
// @version      1.0
// @description  Enables snoozing of tasks and audits on Phabricator dashboard using local Browser storage
// @author       J&C Bachmann GmbH
// @match        https://secure.phabricator.com/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Constants
    const DATEPICKER_JS = 'https://secure.phabricator.com/res/phabricator/8ae55229/rsrc/js/core/behavior-fancy-datepicker.js';
    const DEBUG = false;

    // State variables
    var snoozeOverrideShow = false;
    var tasks = new Map();
    var snoozedCount = 0;

    class Task {
        constructor(id) {
            this.id = id;
            this.blocks = Array();

            // Read date value from storage
            var date = Date.parse(localStorage.getItem(this.id));
            if (isNaN(date) === false) {
                date = new Date(date);
            } else {
                // Task not snoozed - set to last midnight
                date = new Date();
            }
            date.setHours(0, 0, 0, 0);
            this.setDate(date);

            debug('(' + this.id + ') new task');
        }

        setDate(date) {
            if (this.date !== undefined && this.date.getTime() == date.getTime()) {
                return;
            }

            this.date = date;

            // Only store snoozed task dates
            if (date > new Date()) {
                // Date in future -> snoozed
                localStorage.setItem(this.id, date.toISOString());
                debug('(' + this.id + ') stored');

                if (!this.snoozed) {
                    snoozedCount++;
                    updateTaskCounter();
                }

                this.snoozed = true;
            } else {
                // Date in past -> active
                if (localStorage.getItem(this.id) !== null) {
                    localStorage.removeItem(this.id);
                    debug('(' + this.id + ') removed');
                }

                if (this.snoozed) {
                    snoozedCount--;
                    updateTaskCounter();
                }

                this.snoozed = false;
            }

            this.updateToBlocks();
        }

        addBlock(block) {
            this.blocks.push(block);
            debug('(' + this.id + ') block added');
        }

        updateToBlocks() {
            var self = this;
            this.blocks.forEach(function(block) {
                updateTaskBlock(self, block);
            });
        }

        updateFromBlocks() {
            var self = this;
            this.blocks.forEach(function(block) {
                self.setDate(getDateFromTaskBlock(block));
            });
        }
    }

    // Debug logging
    function debug(message) {
        if (DEBUG) {
            console.log(message);
        }
    }

    // Two digit
    function td(d) {
        return (d < 10 ? '0' : '') + d;
    }

    // Convert date to string in format YYYY-MM-DD
    function dateToString(date) {
        return date.getFullYear() + '-' + td(date.getMonth() + 1) + '-' + td(date.getDate());
    }

    // Check whether task id can be found in link
    function isTask(possibleTask) {
        return possibleTask.href.match(/\/(T[0-9]+|r[a-zA-Z0-9]+)$/);
    }

    // Match link and extract task id - e.g. T123
    function getTaskId(task) {
        return task.href.match(/\/(T[0-9]+|r[a-zA-Z0-9]+)$/)[1];
    }

    // Claim up the hierarchy until a list item is reached and declare this as the task block
    // If body is reached return null
    function getTaskBlock(task) {
        var taskBlock = task;

        while (taskBlock.nodeName !== 'LI') {
            if (taskBlock == document.body) {
                return null;
            }

            taskBlock = taskBlock.parentNode;
        }

        return taskBlock;
    }

    // If not overwritten by flat task is hidden completely
    // On override task is marked with a color and otherwise displayed normally
    function filterTaskBlock(taskBlock, task) {
        if (snoozeOverrideShow) {
            taskBlock.style.backgroundColor = 'rgb(255, 255, ' + Math.round(Math.max(200 - 7 * (task.date - new Date()) / (1000 * 60 * 60 * 24), 50)) + ')';
            taskBlock.style.display = '';
        } else {
            taskBlock.style.display = 'none';
        }
    }

    // Revert changes introduced by task filter
    function unfilterTaskBlock(taskBlock) {
        taskBlock.style.display = '';
        taskBlock.style.backgroundColor = '';
    }

    // Properly style task blocks by snoozed status
    function updateTaskBlock(task, block) {
        if (task.date > new Date()) {
            filterTaskBlock(block, task);
        } else {
            unfilterTaskBlock(block);
        }

        setDateToTaskBlock(block, task.date);
    }

    // Add snooze buttons in action blocks on right side
    function addSnoozeButton(taskBlock, task) {
        var actionsBlocks = taskBlock.getElementsByClassName('phui-object-item-actions');
        var actionsBlock;

        // Check if an action block exists otherwise create one
        if (actionsBlocks.length == 1) {
            actionsBlock = actionsBlocks[0];
        } else {
            var frame = taskBlock.firstChild;

            if (frame.childNodes.length == 1) {
                actionsBlock = document.createElement('UL');
                actionsBlock.classList.add('phui-object-item-actions');
                frame.appendChild(actionsBlock);
            }
        }

        // If still untouched add button and datepicker magic
        if (actionsBlock.childNodes.length === 0 || actionsBlock.childNodes.length == 2) {
            // Add task block only once
            task.addBlock(taskBlock);

            var itemNode = document.createElement('LI');
            itemNode.classList.add('phui-list-item-view');
            itemNode.classList.add('phui-list-item-type-link');
            itemNode.classList.add('phui-list-item-has-icon');
            itemNode.dataset.sigil = 'phabricator-date-control';

            // Date value is read and written by datepicker
            var dateInput = document.createElement('INPUT');
            dateInput.value = dateToString(task.date);
            dateInput.type = 'hidden';
            dateInput.classList.add('date-input');
            dateInput.dataset.sigil = 'date-input';
            itemNode.appendChild(dateInput);

            // Time value is complete ignored by datepicker but still presence is required
            var timeInput = document.createElement('INPUT');
            timeInput.type = 'hidden';
            timeInput.dataset.sigil = 'time-input';
            itemNode.appendChild(timeInput);

            var linkNode = document.createElement('A');
            linkNode.classList.add('phui-list-item-href');
            linkNode.dataset.sigil = 'calendar-button';
            linkNode.innerHTML = '<span class="visual-only phui-icon-view phui-font-fa fa-clock-o phui-list-item-icon" aria-hidden="true"></span>';

            itemNode.appendChild(linkNode);
            actionsBlock.appendChild(itemNode);

            updateTaskBlock(task, taskBlock);
        }

        // Correct right offset for other items
        if (actionsBlock.offsetWidth > 0) {
            taskBlock.getElementsByClassName('phui-object-item-content-box')[0].style.marginRight = (actionsBlock.offsetWidth + 6) + 'px';
        }
    }

    function getDateFromTaskBlock(taskBlock) {
        return new Date(taskBlock.getElementsByClassName('date-input')[0].value);
    }

    function setDateToTaskBlock(taskBlock, date) {
        taskBlock.getElementsByClassName('date-input')[0].value = dateToString(date);
    }

    function updateTaskCounter() {
        // Show total count of snoozed tasks near top icon
        document.getElementById('snoozedCounter').innerHTML = snoozedCount;
    }

    // Refresh list of tasks
    function seekTasks() {
        Array.prototype.forEach.call(
            document.getElementsByClassName('phui-object-item-link'),
            function(taskItem) {
                if (!isTask(taskItem)) {
                    return;
                }

                var taskBlock = getTaskBlock(taskItem);
                if (taskBlock === null) {
                    return;

                }

                // Get task object
                var taskId = getTaskId(taskItem);
                var task = tasks.get(taskId);
                if (task === undefined) {
                    task = new Task(taskId);
                    tasks.set(taskId, task);
                }

                // Take care of task block decoration
                addSnoozeButton(taskBlock, task);
            }
        );

        // Pull values from input fields
        tasks.forEach(function(task) {
            task.updateFromBlocks();
        });
    }

    // Listen for DOM changes for very fast updates
    function taskObserver() {
        var observer = new MutationObserver(function(mutations) {
            seekTasks();
        });

        observer.observe(document.body, {
            attributes: true,
            childList: true,
            characterData: true
        });
    }

    // Slow polling as there are still changes which slip through the observer
    function taskSeeker() {
        seekTasks();

        setTimeout(taskSeeker, 500);
    }

    function updateAllTaskBlocks() {
        tasks.forEach(function(task) {
            task.updateToBlocks();
        });
    }

    function initSnoozeToggle() {
        var mainMenuAlerts = document.getElementsByClassName('phabricator-main-menu-alerts');
        if (mainMenuAlerts.length === 0) {
            return false;
        }

        snoozeOverrideShow = localStorage.getItem('snooze override show') === 'true';

        // Add toggle button near alarm icons
        var snoozeToggle = document.createElement('A');
        snoozeToggle.classList.add('alert-notifications');

        if (!snoozeOverrideShow) {
            // Start with correct default state
            snoozeToggle.classList.add('alert-unread');
        }

        snoozeToggle.classList.add('snooze-toggle');
        snoozeToggle.innerHTML = '<span class="phabricator-main-menu-alert-icon phui-icon-view phui-font-fa fa-clock-o" data-sigil="menu-icon"></span><span id="snoozedCounter" class="phabricator-main-menu-alert-count"></span>';

        mainMenuAlerts[0].appendChild(snoozeToggle);

        // Toggle override show snoozed on mouse click
        snoozeToggle.onclick = function(event) {
            snoozeOverrideShow = !snoozeOverrideShow;
            localStorage.setItem('snooze override show', snoozeOverrideShow);

            if (snoozeOverrideShow) {
                snoozeToggle.classList.remove('alert-unread');
            } else {
                snoozeToggle.classList.add('alert-unread');
            }

            updateAllTaskBlocks();
        };

        // Export
        var exportDownload = document.createElement('A');
        exportDownload.style.display = 'none';
        exportDownload.setAttribute('download', 'phabricator-snoozed.json');
        document.body.appendChild(exportDownload);

        var exportButton = document.createElement('A');
        exportButton.classList.add('alert-notifications');
        exportButton.innerHTML = '<span class="phabricator-main-menu-alert-icon phui-icon-view phui-font-fa fa-download" data-sigil="menu-icon">';
        document.getElementsByClassName('phabricator-main-menu-alerts')[0].appendChild(exportButton);
        exportButton.onclick = function(event) {
            exportDownload.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(localStorage)));
            exportDownload.click();
        };

        // Import
        var importUpload = document.createElement('INPUT');
        importUpload.type = 'file';
        importUpload.style.display = 'none';
        importUpload.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (file) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var data = JSON.parse(e.target.result);
                    for (var key in data) {
                        if (key.match(/^(T[0-9]+|r[a-zA-Z0-9]+)$/)) {
                            localStorage.setItem(key, data[key]);
                        }
                    }
                    location.reload();
                };
                reader.readAsText(file);
            }
        });
        document.body.appendChild(importUpload);

        var importButton = document.createElement('A');
        importButton.classList.add('alert-notifications');
        importButton.innerHTML = '<span class="phabricator-main-menu-alert-icon phui-icon-view phui-font-fa fa-upload" data-sigil="menu-icon">';
        document.getElementsByClassName('phabricator-main-menu-alerts')[0].appendChild(importButton);
        importButton.onclick = function(event) {
            importUpload.click();
        };

        return true;
    }

    function initDatepicker() {
        // Add datepicker script
        var datepickerScript = document.createElement('SCRIPT');
        datepickerScript.type = 'text/javascript';
        datepickerScript.src = DATEPICKER_JS;
        datepickerScript.onload = function() {
            // Link date picker some time after javascript file is loaded
            var initDatepickerScript = document.createElement('SCRIPT');
            initDatepickerScript.type = 'text/javascript';
            initDatepickerScript.innerHTML = "JX.initBehaviors({ 'fancy-datepicker' : [{ format: 'Y-m-d', weekStart: 1 }] });";
            document.body.appendChild(initDatepickerScript);
        };
        document.body.appendChild(datepickerScript);

    }

    // Initialization of whole system called once at start
    function init() {
        if (!initSnoozeToggle()) {
            console.log('Could not initialize snooze toggle - most likely login is required');
            return;
        }

        initDatepicker();

        taskSeeker();
        taskObserver();
    }

    init();
})();
