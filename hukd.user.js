// ==UserScript==
// @name       HUKD Enhancements
// @include    https://www.hotukdeals.com*
// ==/UserScript==


const DEAL_SELECTOR = '.thread--deal';

/** HTML Snippets: **/

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
<button id="load10" class="btn--mode-special btn cust-btn">Load Pages 2-11</button>
`;

let content = document.querySelector('.tGrid-row.height--all-full');
content.innerHTML = customHTML + content.innerHTML;

let nextPageIdx = 2;


/** Button Handlers: **/

document.querySelector('#sortScore').addEventListener('click', sortScore);
document.querySelector('#sortPrice').addEventListener('click', sortPrice);
document.querySelector('#over200').addEventListener('click', e => overTemp(200));
document.querySelector('#over300').addEventListener('click', e => overTemp(300));
document.querySelector('#over500').addEventListener('click', e => overTemp(500));
document.querySelector('#minPrice').addEventListener('click', e => {
    let min = promptFloat();
    if (Number.isNaN(min)) {
        return;
    }
    alterDeals(deals => {
        return deals.filter(deal => deal.price >= min);
    });
});
document.querySelector('#maxPrice').addEventListener('click', e => {
    let max = promptFloat();
    if (Number.isNaN(max)) {
        return;
    }
    alterDeals(deals => {
        return deals.filter(deal => deal.price <= max);
    });
});
document.querySelector('#load5').addEventListener('click', e => loadPages(5, e) );
document.querySelector('#load10').addEventListener('click', e => loadPages(10, e) );

function promptFloat() {
    return parseFloat(prompt());
}

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
    alterDeals(deals => {
        return deals.filter(deal => deal.score >= temp);
    });
}

/**
 * Update the DOM and alter deals as per callback.
 */
function alterDeals(alterCB) {
    let dealParent = null;

    let deals = Array.from(document.querySelectorAll(DEAL_SELECTOR)).map(function (dealElem) {
        let deal = scrapeDealElem(dealElem);
        if (!dealParent) {
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
 * Parse price, score etc from a deal element.
 */
function scrapeDealElem(elem) {
    // Parse Score:
    let score = 0;
    let voteElem = elem.querySelector('.vote-box');
    if (voteElem) {
        score = parseInt(voteElem.innerText);
    }

    // Parse Price:
    let price = 0;
    let priceElem = elem.querySelector('.thread-price');

    if (priceElem) {
        // NB: parseInt cannot handle the £ prefix nor commas.
        price = parseInt(priceElem.innerText.replace('£', '').replace(',', ''));
    }

    return {
        score: score,
        price: price,
    };
}

async function loadPages(numPagesToLoad, event) {
    // Show "progressing" indicator on clicked button:
    event.srcElement.innerText = '...';
    let dealContainer = getDealContainer();
    let baseURL = location.origin + location.pathname;
    let loadedCount = 0;
    for (let i = 0; i < numPagesToLoad; i++) {
        let nodes = Array.from(await getPageDeals(baseURL + '?page=' + nextPageIdx));
        // nodes.forEach(n => { container.appendChild(n); });
        let nodeHTML = nodes.map(n => n.outerHTML).join('');
        dealContainer.innerHTML = dealContainer.innerHTML + nodeHTML; 
        nextPageIdx++;
    }
    // Update visible page numbers on all buttons:
    document.querySelector('#load5').innerText = `Load Pages ${nextPageIdx}-${nextPageIdx+4}`;
    document.querySelector('#load10').innerText = `Load Pages ${nextPageIdx}-${nextPageIdx+9}`
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