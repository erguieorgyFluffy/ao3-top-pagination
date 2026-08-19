# AO3 Top Pagination

A lightweight Tampermonkey userscript that adds convenient navigation controls to AO3 pages.

It copies AO3's existing pagination to the top of long result lists and adds quick **Edit** buttons where they're useful.

## Features

* Adds pagination above AO3 work results.
* Adds pagination above AO3 Tag Search results.
* Adds pagination above AO3 works listings under tags.
* Supports Previous / Next and page numbers.
* Preserves AO3's existing links and search parameters.
* Adds an **Edit** button at the top of Work Skin pages.
* Adds an **Edit** button next to **↑ Top** at the bottom of work pages.
* Does not modify AO3's original controls.
* Automatically reacts to relevant DOM changes.
* No external libraries.
* No network requests.
* No special permissions required.

## Supported Pages

Currently supported:

* AO3 Work Search
* AO3 Tag Search
* AO3 works listings under tags
* AO3 Work pages
* AO3 Work Skin pages

Examples:

* `https://archiveofourown.org/works/search`
* `https://archiveofourown.org/tags/search`
* `https://archiveofourown.org/tags/*/works`
* `https://archiveofourown.org/works/*`
* `https://archiveofourown.org/skins/*`

## Installation

### 1. Install Tampermonkey

Install the Tampermonkey browser extension for your browser.

### 2. Install the userscript

Open `ao3-top-pagination.user.js` and choose the option to install it in Tampermonkey.

Alternatively, use the **Raw** button on GitHub to install it directly.
