// ==UserScript==
// @name       HUKD Enhancements
// @include    https://www.hotukdeals.com/search*
// @version    1.0.3
// ==/UserScript==

const DEAL_SELECTOR = 'article.thread--type-list';

/**
 * @global Track which pages have been loaded in.
 * @see loadPages
 */
let nextPageIdx = 2;

// Todo: See 1n.

/** Add Custom HTML to Page: **/

let customHTML = `
<style>
.cust-btn {
    margin: 10px;
    margin-right: 0px;
}
#batchSeparator {
    font-size: 4em;
    margin: 30px;
}
</style>
<button id="sortScore" class="btn--mode-special btn cust-btn">Sort Temp</button>
<button id="sortPrice" class="btn--mode-special btn cust-btn">Sort Price</button>
<button id="over200" class="btn--mode-special btn cust-btn">&gt;=200</button>
<button id="over300" class="btn--mode-special btn cust-btn">&gt;=300</button>
<button id="over500" class="btn--mode-special btn cust-btn">&gt;=500</button>
<button id="minPrice" class="btn--mode-special btn cust-btn">Min Price</button>
<button id="maxPrice" class="btn--mode-special btn cust-btn">Max Price</button>
<button id="load5" class="btn--mode-special btn cust-btn">Load Pages 2-6</button>
<button id="loadX" class="btn--mode-special btn cust-btn">Load X Pages</button>
<button id="filterToKeywords" class="btn--mode-special btn cust-btn">Filter to Keywords</button>
<button id="removeKeywords" class="btn--mode-special btn cust-btn">Remove Keywords</button>
<button id="hideExpired" class="btn--mode-special btn cust-btn">Hide Expired</button>
`;

setTimeout(main, 1000);

function main() {
    // Add the custom HTML to the page:
    let content = document.querySelector('.tGrid-row.height--all-full');
    content.innerHTML = customHTML + content.innerHTML;


    /** Bind Button Handlers: **/

    btnClickHandler('#sortScore', sortScore);
    btnClickHandler('#sortPrice', sortPrice);
    btnClickHandler('#over200',  e => overTemp(200));
    btnClickHandler('#over300',  e => overTemp(300));
    btnClickHandler('#over500',  e => overTemp(500));
    btnClickHandler('#minPrice', e => {
        let min = promptFloat(); // Get min value.
        if (min===null) return; // Stop on bad input
        alterDeals( deals =>  deals.filter(deal => deal.price >= min) );
    });
    btnClickHandler('#maxPrice', e => {
        let max = promptFloat();
        if (max===null) return; // Stop on bad input
        alterDeals( deals => deals.filter(deal => deal.price <= max) );
    });
    btnClickHandler('#load5', e => loadPages(5, e), false); // `loadPages` will update button text instead.
    btnClickHandler('#loadX', e => {
        let pages = promptInt(true, 1, 50);
        if (pages===null) return; // Stop on bad input
        loadPages(pages, e);
    }, false);
    btnClickHandler('#filterToKeywords', e => filterKeywords(true));
    btnClickHandler('#removeKeywords', e => filterKeywords(false));
    btnClickHandler('#hideExpired', e => hideExpired(false));
}


function btnClickHandler(selector, cb, showLoading=true) {
    let btn = document.querySelector(selector);
    btn.addEventListener('click', async e => {
        let initialBtnText = btn.innerText;
        if (showLoading) {
            btn.innerText = '...'; // Set button "Loading" text. A small delay is necessary here for the DOM to fully
            await getDelay(50);    // update button text before enacting any other "slow" DOM modifications.
        }
        cb(e); // Run callback.
        if (showLoading) btn.innerText = initialBtnText;
    });
}

/** Functions: Fetch User Input: */

/**
 * Prompt user for a float value.
 * @returns {?number} Prompted number or `null` if user supplied bad input or filters are unmatched.
 */
function promptFloat(abs=false, min=null, max=null) {
    return validatePromptedNumber(parseFloat(prompt()), abs, min, max);
}
/**
 * Prompt user for a integer value.
 * @returns {?number} Prompted number or `null` if user supplied bad input or filters are unmatched.
 */
function promptInt(abs=false, min=null, max=null) {
    return validatePromptedNumber(parseInt(prompt()), abs, min, max);
}
/**
 * Prompt user for string.
 * @returns {?number} String or `null` if user supplied bad input or filters are unmatched.
 */
function promptString(toLower=false, trim=true, allowEmpty=false) {
    let str = prompt();
    if (str === null || !allowEmpty && str.trim() === '') { // Reject empty input.
        return null;
    }
    str = trim ? str.trim() : str;
    str = toLower ? str.toLowerCase() : str;
    return str;
}

/**
 * @returns {?number} Number or `null` if user supplied bad input or filters are unmatched.
 */
function validatePromptedNumber(rawVal, abs=false, min=null, max=null) {
    let val = abs ? Math.abs(rawVal) : rawVal;
    if (min !== null && rawVal < min) {
        return null;
    }
    if (max !== null && rawVal > max) {
        return null
    }
    return Number.isNaN(val) ? null : val;
}

/** Functions: DOM modification: **/

function sortScore() {
    alterDeals(deals => {
        return deals.sort((a, b) => b.score - a.score); // Desc
    });
}
function sortPrice() {
    alterDeals(deals => {
        console.log(deals);
        return deals.sort((a, b) => a.price - b.price); // Asc
    });
}
function overTemp(temp) {
    alterDeals( deals => deals.filter(deal => deal.score >= temp) );
}

/**
 * @param {boolean} whitelist Flag for whitelist or blacklist.
 */
function filterKeywords(whitelist=false) {
    let word = promptString(true); // Lowercase input only.
    if (word===null) return; // Exit on bad input.

    if (whitelist) {  // Whitelist:
        alterDeals( deals => deals.filter(deal => deal.title.toLowerCase().includes(word)) );
    } else {       // Blacklist:
        alterDeals( deals => deals.filter(deal => !deal.title.toLowerCase().includes(word)) );
    }
}

/**
 * Remove expired deals from list.
 */
function hideExpired() {
    alterDeals(deals => deals.filter(deal => !deal.expired));
}

/**
 * Add, remove or reorder deals and update the DOM.
 * Deals will then be re-rendered using content from `deals[i].elem.outerHTML`.
 * @param alterCB Example CB: deals => deals.filter(deal => deal.score>=200)
 * @see scrapeDealElem For how items in `deals` array are set.
 */
function alterDeals(alterCB) {
    let dealParent = null;

    let deals = Array.from(document.querySelectorAll(DEAL_SELECTOR)).map(function (dealElem) {
        let deal = scrapeDealElem(dealElem);
        if (!dealParent) { // Fetch parent element from first matching deal.
            dealParent = dealElem.parentElement;
        }
        dealElem.remove();
        deal.elem = dealElem;
        return deal;
    });

    if (deals.length < 1) {
        return;
    }

    let updatedDeals = alterCB(deals);
    console.log('dealsBefore', deals);
    console.log('dealsAfter', updatedDeals);

    // Delete old batch separator, if exists:
    let bs = document.querySelector('#batchSeparator');
    if (bs) {
        bs.remove();
    }
    // Update DOM:
    let updatedDealsHTML = updatedDeals.map(function (deal) { return deal.elem.outerHTML; }).join('');
    dealParent.innerHTML = dealParent.innerHTML + updatedDealsHTML + '<div id="batchSeparator">Batch completed.</div>';
}

/**
 * Scrape price, score etc from a deal element.
 */
function scrapeDealElem(elem) {
    // Scrape Score:
    let score = 0; // NB: Score CAN be a negative value here.
    let voteElem = elem.querySelector('.vote-box');
    if (voteElem) {
        score = parseInt(voteElem.innerText);
    }

    // Scrape expired:
    let expired = voteElem.classList.contains('text--color-grey');

    // Scrape Price:
    let price = 0;
    let priceElem = elem.querySelector('.thread-price');

    if (priceElem) {
        // NB: parseInt cannot handle the £ prefix nor commas.
        price = parseInt(priceElem.innerText.replace('£', '').replace(',', ''));
    }

    // Scrape date:
    let ribbons = elem.querySelectorAll('.metaRibbon');
    let lastRibbon = ribbons[ribbons.length - 1];
    let dateStr = lastRibbon.querySelector('.hide--toW3').innerText;
    let date = parseDealDate(dateStr);

    // Scrape title:
    let title = elem.querySelector('.thread-title').innerText;

    return { score, expired, price, date, dateStr, title };
}

/**
 * Convert HUKD deal date string into JS {Date}.
 * Example formats for date string:
 * - Made hot 1 h, 13 m ago
 * - Made hot 34 m ago
 * - Posted 13th Nov
 * - Posted 24th Nov 2019
 * - Posted 7 h, 0 m ago
 * @param {str} str The HUKD date string.
 * @returns {Date}
 */
function parseDealDate(str) {
    const MAX_MONTH_STR_LEN = 6; // Length of e.g. "31 Jan"

    // Remove unneeded words:
    for (let keyword of ['Made hot', 'ago', 'Posted', 'Refreshed']) {
        str = str.replace(keyword, '');
    }
    str = str.trim();

    let prevLen = str.length;
    // Remove ordinal suffix (st, nd, rd, th), if applicable:
    for (let suffix of ['st', 'nd', 'rd', 'th']) {
        str = str.replace(suffix, '');
    }

    let date = null;
    // If this has a month string e.g. "13 Nov":
    if (prevLen !== str.length) {
        // If the str does not have year part:
        if (str.length <= MAX_MONTH_STR_LEN) {
            // Append the year part:
            let now = new Date();
            str += ' ' + now.getFullYear();
        }
        date = new Date(str);

    // This is a time-only date e.g. "1 h, 34 m":
    } else {
        let hours = 0; // Hours/mins to subtract from curr date.
        let mins = 0;
        let parts = str.split(',');
        if (parts.length > 1) {
            hours = parseInt(parts[0]);
            mins = parseInt(parts[1]);
        } else {
            mins = parseInt(parts[0]);
        }
        let secsDiff = hours*60*60 + 60*mins;
        date = new Date(Date.now() - secsDiff*1000);
    }

    return date;
}

/**
 * Load content from other pages, and add to DOM.
 * @param {*} numPagesToLoad
 * @param {Event} event
 * @see nextPageIdx (Global)
 */
async function loadPages(numPagesToLoad, event) {
    // Show "progressing" indicator on clicked button:
    event.target.innerText = '...';
    let dealContainer = getDealContainer();
    let searchQuery = (new URLSearchParams(location.search)).get('q');
    let currSearchURL = location.origin + location.pathname + '?q=' + searchQuery;
    let loadedCount = 0;
    for (let i = 0; i < numPagesToLoad; i++) {
        let nodes = Array.from(await getPageDeals(currSearchURL + '&page=' + nextPageIdx));
        // nodes.forEach(n => { container.appendChild(n); });
        let nodeHTML = nodes.map(n => n.outerHTML).join('');
        dealContainer.innerHTML = dealContainer.innerHTML + nodeHTML;
        nextPageIdx++;
    }
    // Update visible page numbers on all buttons:
    document.querySelector('#load5').innerText = `Load Pages ${nextPageIdx}-${nextPageIdx+4}`;
}

async function getPageDeals(url) {
    let dp = new DOMParser();
    let resp = await fetch(url);
    let page = dp.parseFromString(await resp.text(), 'text/html');
    return page.querySelectorAll(DEAL_SELECTOR);
}

/**
 * @returns {Element}
 */
function getDealContainer() {
    return document.querySelector(DEAL_SELECTOR).parentElement;
}

/** Helper Methods: **/

function getDelay(ms){
	return new Promise(resolve => setTimeout(()=>resolve(ms), ms));
}
