// ==UserScript==
// @name         Phabricator Snooze Demo
// @namespace    https://www.jcbachmann.com
// @version      1.1
// @description  Enables snoozing of items on Phabricator interface using local Browser storage
// @author       J&C Bachmann GmbH
// @match        https://secure.phabricator.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Constants
    const DATEPICKER_JS = 'https://secure.phabricator.com/res/phabricator/8ae55229/rsrc/js/core/behavior-fancy-datepicker.js';
    const DEBUG = false;

    // State variables
    var snoozeOverrideShow = false;
    var items = new Map();
    var snoozedCount = 0;

    class Item {
        constructor(id) {
            this.id = id;
            this.blocks = Array();

            // Read date value from storage
            var date = Date.parse(localStorage.getItem(this.id));
            if (isNaN(date) === false) {
                date = new Date(date);
            } else {
                // Item not snoozed - set to last midnight
                date = new Date();
            }
            date.setHours(0, 0, 0, 0);
            this.setDate(date);

            debug('(' + this.id + ') new item');
        }

        setDate(date) {
            if (this.date !== undefined && this.date.getTime() == date.getTime()) {
                return;
            }

            this.date = date;

            // Only store snoozed item dates
            if (date > new Date()) {
                // Date in future -> snoozed
                localStorage.setItem(this.id, date.toISOString());
                debug('(' + this.id + ') stored');

                if (!this.snoozed) {
                    snoozedCount++;
                    updateItemCounter();
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
                    updateItemCounter();
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
                updateItemBlock(self, block);
            });
        }

        updateFromBlocks() {
            var self = this;
            this.blocks.forEach(function(block) {
                self.setDate(getDateFromItemBlock(block));
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
    
    // Escape special regex characters in string
    function escapeRegExp(str) {
        return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    }

    // Match link and extract item id - e.g. T123
    function getItemId(item) {
        var regexString = '^' + escapeRegExp(window.location.origin) + '\/(.+)$';
        var match = item.href.match(new RegExp(regexString));
        if (match && match.length === 2) {
            return match[1];
        } else {
            console.log('could not match \'' + item.href + '\' with \'' + regexString + '\': ' + match);
            return undefined;
        }
    }

    // Climb up the hierarchy until a list item is reached and declare this as the item block
    // If body is reached return null
    function getItemBlock(item) {
        var itemBlock = item;

        while (itemBlock.nodeName !== 'LI') {
            if (itemBlock == document.body) {
                return null;
            }

            itemBlock = itemBlock.parentNode;
        }

        return itemBlock;
    }

    // Scale past days to hue
    function daysToHue(days) {
        var minHue = 0;
        var maxHue = 200;
        var minDays = 0;
        var maxDays = 14;
        var hue = (maxHue - minHue) * (days - minDays) / (maxDays - minDays) + minHue;
        return Math.max(minHue, Math.min(hue, maxHue));
    }

    // If not overwritten by flat item is hidden completely
    // On override item is marked with a color and otherwise displayed normally
    function filterItemBlock(itemBlock, item) {
        if (snoozeOverrideShow) {
            var snoozeItems = itemBlock.getElementsByClassName('snooze-link');
            if (snoozeItems.length > 0) {
                var days = Math.ceil((item.date - new Date()) / (1000 * 60 * 60 * 24));
                snoozeItems[0].style.backgroundColor = 'hsl(' + daysToHue(days) + ',100%,30%)';
                snoozeItems[0].style.color = 'white';
                snoozeItems[0].innerHTML = '<span class="visual-only phui-icon-view phui-font-fa fa-clock-o phui-list-item-icon" style="color:white;" aria-hidden="true"></span><div style="font-size:8pt;text-align:center;position:absolute;width:100%;padding-top:3px;">+' + days + '</div>';
            }
            itemBlock.style.display = '';
        } else {
            itemBlock.style.display = 'none';
        }
    }

    // Revert changes introduced by item filter
    function unfilterItemBlock(itemBlock) {
        itemBlock.style.display = '';
        itemBlock.style.backgroundColor = '';
    }

    // Properly style item blocks by snoozed status
    function updateItemBlock(item, block) {
        if (item.date > new Date()) {
            filterItemBlock(block, item);
        } else {
            unfilterItemBlock(block);
        }

        setDateToItemBlock(block, item.date);
    }

    // Add snooze buttons in action blocks on right side
    function addSnoozeButton(itemBlock, item) {
        var actionsBlocks = itemBlock.getElementsByClassName('phui-oi-actions');
        var actionsBlock;

        // Check if an action block exists otherwise create one
        if (actionsBlocks.length == 1) {
            actionsBlock = actionsBlocks[0];
        } else {
            var frame = itemBlock.firstChild;

            if (frame.childNodes.length == 1) {
                actionsBlock = document.createElement('UL');
                actionsBlock.classList.add('phui-oi-actions');
                frame.appendChild(actionsBlock);
            }
        }

        // If still untouched add button and datepicker magic
        if (actionsBlock.getElementsByClassName('fa-clock-o').length === 0) {
            // Add item block only once
            item.addBlock(itemBlock);

            var itemNode = document.createElement('LI');
            itemNode.classList.add('phui-list-item-view');
            itemNode.classList.add('phui-list-item-type-link');
            itemNode.classList.add('phui-list-item-has-icon');
            itemNode.dataset.sigil = 'phabricator-date-control';

            // Date value is read and written by datepicker
            var dateInput = document.createElement('INPUT');
            dateInput.value = dateToString(item.date);
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
            linkNode.classList.add('snooze-link');
            linkNode.dataset.sigil = 'calendar-button';
            linkNode.style.borderRadius = '3px';
            linkNode.innerHTML = '<span class="visual-only phui-icon-view phui-font-fa fa-clock-o phui-list-item-icon" aria-hidden="true"></span>';

            itemNode.appendChild(linkNode);
            actionsBlock.appendChild(itemNode);

            updateItemBlock(item, itemBlock);
        }

        // Correct right offset for other items
        if (actionsBlock.offsetWidth > 0) {
            itemBlock.getElementsByClassName('phui-oi-content-box')[0].style.marginRight = (actionsBlock.offsetWidth + 6) + 'px';
        }
    }

    function getDateFromItemBlock(itemBlock) {
        return new Date(itemBlock.getElementsByClassName('date-input')[0].value);
    }

    function setDateToItemBlock(itemBlock, date) {
        itemBlock.getElementsByClassName('date-input')[0].value = dateToString(date);
    }

    function updateItemCounter() {
        // Show total count of snoozed items near top icon
        document.getElementById('snoozedCounter').innerHTML = snoozedCount;
    }

    // Refresh list of items
    function seekItems() {
        Array.prototype.forEach.call(
            document.getElementsByClassName('phui-oi-link'),
            function(itemItem) {
                var itemBlock = getItemBlock(itemItem);
                if (itemBlock === null) {
                    return;
                }

                // Get item object
                var itemId = getItemId(itemItem);
                var item = items.get(itemId);
                if (item === undefined) {
                    item = new Item(itemId);
                    items.set(itemId, item);
                }

                // Take care of item block decoration
                addSnoozeButton(itemBlock, item);
            }
        );

        // Pull values from input fields
        items.forEach(function(item) {
            item.updateFromBlocks();
        });
    }

    // Listen for DOM changes for very fast updates
    function itemObserver() {
        var observer = new MutationObserver(function(mutations) {
            seekItems();
        });

        observer.observe(document.body, {
            attributes: true,
            childList: true,
            characterData: true
        });
    }

    // Slow polling as there are still changes which slip through the observer
    function itemSeeker() {
        seekItems();

        setTimeout(itemSeeker, 500);
    }

    function updateAllItemBlocks() {
        items.forEach(function(item) {
            item.updateToBlocks();
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

            updateAllItemBlocks();
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
                        localStorage.setItem(key, data[key]);
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

        itemSeeker();
        itemObserver();
    }

    init();
})();
