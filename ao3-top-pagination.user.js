// ==UserScript==
// @name         AO3 Top Pagination
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Adds AO3's existing pagination above the works list.
// @author       GPT-5.6 Luna
// @match        https://archiveofourown.org/tags/*/works*
// @match        https://archiveofourown.org/tags/*/works/*
// @match        https://archiveofourown.org/works/search*
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
    // FIND WORK LIST
    // =========================================================

    function findWorksList() {
        return document.querySelector(
            'ol.work.index.group'
        );
    }

    // =========================================================
    // FIND AO3'S ORIGINAL PAGINATION
    // =========================================================

    function findOriginalPagination(worksList) {
        if (!worksList) {
            return null;
        }

        const paginations = Array.from(
            document.querySelectorAll(
                'ol.pagination.actions[aria-label="Pagination"]'
            )
        );

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
                worksList.compareDocumentPosition(
                    pagination
                );

            const isAfterWorks =
                Boolean(
                    position &
                    Node.DOCUMENT_POSITION_FOLLOWING
                );

            if (isAfterWorks) {
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
        worksList
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
         * This preserves AO3's existing links and URLs.
         */
        const clone =
            originalPagination.cloneNode(true);

        clone.setAttribute(
            TOP_PAGINATION_MARKER,
            'true'
        );

        /*
         * Avoid duplicate IDs inside the cloned markup.
         */
        clone
            .querySelectorAll('[id]')
            .forEach((element) => {
                element.removeAttribute('id');
            });

        /*
         * Give the copied navigation a distinct
         * accessible label.
         */
        clone.setAttribute(
            'aria-label',
            'Top Pagination'
        );

        wrapper.appendChild(clone);

        /*
         * Put the copied pagination directly
         * before the first work.
         */
        worksList.parentNode.insertBefore(
            wrapper,
            worksList
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
            const worksList =
                findWorksList();

            if (!worksList) {
                removeTopPagination();
                return;
            }

            const originalPagination =
                findOriginalPagination(
                    worksList
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
             * If our pagination is already directly
             * before the works list, keep it.
             */
            if (
                existing &&
                existing.nextElementSibling ===
                    worksList
            ) {
                return;
            }

            removeTopPagination();

            createTopPagination(
                originalPagination,
                worksList
            );

        } finally {
            updating = false;
        }
    }

    // =========================================================
    // DEBOUNCED UPDATE
    // =========================================================

    function scheduleUpdate() {
        clearTimeout(updateTimer);

        updateTimer = setTimeout(
            () => {
                updatePagination();
            },
            250
        );
    }

    // =========================================================
    // OBSERVE AO3 PAGE CHANGES
    // =========================================================

    const observer =
        new MutationObserver(
            (mutations) => {

                const relevant =
                    mutations.some(
                        (mutation) => {

                            if (
                                mutation.type !==
                                'childList'
                            ) {
                                return false;
                            }

                            /*
                             * Ignore mutations that only
                             * happen inside our own copy.
                             */
                            const target =
                                mutation.target;

                            if (
                                target instanceof
                                Element &&
                                target.closest(
                                    `[${TOP_PAGINATION_MARKER}]`
                                )
                            ) {
                                return false;
                            }

                            return (
                                mutation.addedNodes.length > 0 ||
                                mutation.removedNodes.length > 0
                            );
                        }
                    );

                if (relevant) {
                    scheduleUpdate();
                }
            }
        );

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
