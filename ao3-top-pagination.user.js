// ==UserScript==
// @name         AO3 Top Pagination
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Adds AO3's existing pagination controls above search results and works lists.
// @author       GPT-5.6 Luna
// @match        https://archiveofourown.org/tags/*/works*
// @match        https://archiveofourown.org/tags/*/works/*
// @match        https://archiveofourown.org/works/search*
// @match        https://archiveofourown.org/tags/search*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const TOP_PAGINATION_ID = 'ao3-top-pagination';
    const TOP_PAGINATION_MARKER = 'data-ao3-top-pagination';

    let updateTimer = null;
    let updating = false;

    // =========================================================
    // FIND THE RESULTS LIST
    // =========================================================

    function findResultsList() {
        // Work listings
        const worksList = document.querySelector(
            'ol.work.index.group'
        );

        if (worksList) {
            return worksList;
        }

        // Tag search results
        const tagList = document.querySelector(
            'ol.tag.index.group'
        );

        if (tagList) {
            return tagList;
        }

        return null;
    }

    // =========================================================
    // FIND AO3'S ORIGINAL PAGINATION
    // =========================================================

    function findOriginalPagination(resultsList) {
        if (!resultsList) {
            return null;
        }

        const paginations = document.querySelectorAll(
            'ol.pagination.actions[aria-label="Pagination"]'
        );

        /*
         * Find the first genuine AO3 pagination that appears
         * after the results list.
         */
        for (const pagination of paginations) {
            // Never use our own copied pagination.
            if (
                pagination.closest(
                    `[${TOP_PAGINATION_MARKER}]`
                )
            ) {
                continue;
            }

            const position =
                resultsList.compareDocumentPosition(
                    pagination
                );

            const isAfterResults =
                Boolean(
                    position &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );

            if (isAfterResults) {
                return pagination;
            }
        }

        return null;
    }

    // =========================================================
    // REMOVE OUR TOP PAGINATION
    // =========================================================

    function removeTopPagination() {
        const existing =
            document.getElementById(
                TOP_PAGINATION_ID
            );

        if (existing) {
            existing.remove();
        }
    }

    // =========================================================
    // CREATE TOP PAGINATION
    // =========================================================

    function createTopPagination(
        originalPagination,
        resultsList
    ) {
        const wrapper =
            document.createElement('div');

        wrapper.id =
            TOP_PAGINATION_ID;

        wrapper.setAttribute(
            TOP_PAGINATION_MARKER,
            'true'
        );

        wrapper.style.cssText = [
            'width: 100%',
            'box-sizing: border-box',
            'margin: 0 0 1em 0',
            'padding: 0'
        ].join(';');

        /*
         * Clone AO3's real pagination.
         *
         * This preserves AO3's existing links,
         * page numbers, Previous/Next controls,
         * and search parameters.
         */
        const clone =
            originalPagination.cloneNode(true);

        clone.setAttribute(
            TOP_PAGINATION_MARKER,
            'true'
        );

        /*
         * Avoid duplicate IDs inside the copied markup.
         */
        clone
            .querySelectorAll('[id]')
            .forEach((element) => {
                element.removeAttribute('id');
            });

        /*
         * Give the copied navigation its own
         * accessible label.
         */
        clone.setAttribute(
            'aria-label',
            'Top Pagination'
        );

        wrapper.appendChild(clone);

        /*
         * Insert the copied pagination immediately
         * before the results list.
         */
        resultsList.parentNode.insertBefore(
            wrapper,
            resultsList
        );
    }

    // =========================================================
    // UPDATE
    // =========================================================

    function updatePagination() {
        if (updating) {
            return;
        }

        updating = true;

        try {
            const resultsList =
                findResultsList();

            if (!resultsList) {
                removeTopPagination();
                return;
            }

            const originalPagination =
                findOriginalPagination(
                    resultsList
                );

            if (!originalPagination) {
                removeTopPagination();
                return;
            }

            const existing =
                document.getElementById(
                    TOP_PAGINATION_ID
                );

            /*
             * If our pagination is already immediately
             * before the results list, leave it alone.
             */
            if (
                existing &&
                existing.nextElementSibling ===
                    resultsList
            ) {
                return;
            }

            removeTopPagination();

            createTopPagination(
                originalPagination,
                resultsList
            );

        } finally {
            updating = false;
        }
    }

    // =========================================================
    // DEBOUNCE
    // =========================================================

    function scheduleUpdate() {
        clearTimeout(updateTimer);

        updateTimer = setTimeout(
            updatePagination,
            200
        );
    }

    // =========================================================
    // OBSERVE AO3 PAGE CHANGES
    // =========================================================

    const observer =
        new MutationObserver(() => {
            scheduleUpdate();
        });

    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

    // =========================================================
    // INITIAL RUN
    // =========================================================

    updatePagination();

})();
