# AO3 Top Pagination

A lightweight Tampermonkey userscript that adds AO3's existing pagination controls above search results.

Instead of making you scroll all the way to the bottom of a long results page, the script copies AO3's own pagination controls and places them at the top of the results list.

## Features

- Adds pagination above AO3 work results.
- Adds pagination above AO3 Tag Search results.
- Adds pagination above AO3 works listings under tags.
- Uses AO3's existing pagination links.
- Preserves AO3's original search parameters.
- Supports page numbers.
- Supports Previous / Next.
- Does not modify AO3's original pagination.
- Automatically reacts to relevant DOM changes.
- No external libraries.
- No network requests.
- No special permissions required.

## Supported Pages

Currently supported:

- AO3 Work Search
- AO3 Tag Search
- AO3 works listings under tags

Examples:

- `https://archiveofourown.org/works/search`
- `https://archiveofourown.org/tags/search`
- `https://archiveofourown.org/tags/*/works`

## Installation

### 1. Install Tampermonkey

Install the Tampermonkey browser extension for your browser.

### 2. Install the userscript

Open `ao3-top-pagination.user.js` and choose the option to install the userscript in Tampermonkey.

Alternatively, use the **Raw** button on GitHub to install it directly.
