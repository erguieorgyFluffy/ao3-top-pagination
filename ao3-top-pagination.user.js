// ==UserScript==
// @name         AO3 Top Pagination
// @namespace    http://tampermonkey.net/
// @version      3.6
// @description  Adds missing top pagination to AO3 result lists and keeps it synchronized with AO3's native pagination.
// @author       GPT-5.6 Luna
// @match        https://archiveofourown.org/tags/*/works*
// @match        https://archiveofourown.org/tags/*/works/*
// @match        https://archiveofourown.org/tags/*/bookmarks*
// @match        https://archiveofourown.org/tags/search*
// @match        https://archiveofourown.org/works/search*
// @match        https://archiveofourown.org/people/search*
// @match        https://archiveofourown.org/bookmarks/search*
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
    // FIND AO3 MAIN CONTENT
    // =========================================================

    function findMain() {
        return document.querySelector('#main');
    }

    // =========================================================
    // FIND SUPPORTED RESULT LIST
    // =========================================================

    function findResultsList() {
        const main = findMain();

        if (!main) {
            return null;
        }

        /*
         * Supported AO3 result lists:
         *
         * Works:
         *   <ol class="work index group">
         *
         * Tag search:
         *   <ol class="tag index group">
         *
         * People search:
         *   <ol class="pseud index group">
         *
         * Bookmark search:
         *   <ol class="bookmark index group">
         */

        return main.querySelector(
            'ol.work.index.group, ' +
            'ol.tag.index.group, ' +
            'ol.pseud.index.group, ' +
            'ol.bookmark.index.group'
        );
    }

    // =========================================================
    // FIND PAGINATION ELEMENTS
    // =========================================================

    function findPaginations() {
        const main = findMain();

        if (!main) {
            return [];
        }

        /*
         * Do NOT depend on "pagy".
         *
         * Your tag-page HTML currently has:
         *
         *   class="pagination actions pagy"
         *
         * while the bookmark page has:
         *
         *   class="pagination actions"
         *
         * Therefore we intentionally select the stable
         * pagination/actions portion.
         */

        return Array.from(
            main.querySelectorAll(
                'ol.pagination.actions'
            )
        );
    }

    // =========================================================
    // IDENTIFY OUR OWN PAGINATION
    // =========================================================

    function isOurPagination(element) {
        if (!element) {
            return false;
        }

        return Boolean(
            element.closest(
                `[${TOP_PAGINATION_MARKER}]`
            )
        );
    }

    // =========================================================
    // DOM ORDER HELPERS
    // =========================================================

    function comesBefore(first, second) {
        if (
            !first ||
            !second ||
            first === second
        ) {
            return false;
        }

        const position =
            first.compareDocumentPosition(second);

        if (
            position &
            Node.DOCUMENT_POSITION_DISCONNECTED
        ) {
            return false;
        }

        /*
         * FOLLOWING means "second follows first".
         */
        return Boolean(
            position &
            Node.DOCUMENT_POSITION_FOLLOWING
        );
    }

    function comesAfter(first, second) {
        if (
            !first ||
            !second ||
            first === second
        ) {
            return false;
        }

        const position =
            first.compareDocumentPosition(second);

        if (
            position &
            Node.DOCUMENT_POSITION_DISCONNECTED
        ) {
            return false;
        }

        /*
         * PRECEDING means "second precedes first".
         */
        return Boolean(
            position &
            Node.DOCUMENT_POSITION_PRECEDING
        );
    }

    // =========================================================
    // FIND NATIVE TOP PAGINATION
    // =========================================================

    function findNativeTopPagination(resultsList) {
        if (!resultsList) {
            return null;
        }

        const candidates =
            findPaginations().filter(
                (pagination) => {
                    /*
                     * Never treat our clone as AO3's
                     * native pagination.
                     */
                    if (
                        isOurPagination(
                            pagination
                        )
                    ) {
                        return false;
                    }

                    /*
                     * Native top pagination must be before
                     * the results list.
                     */
                    return comesBefore(
                        pagination,
                        resultsList
                    );
                }
            );

        if (!candidates.length) {
            return null;
        }

        /*
         * Use the pagination closest to the result list.
         */
        let closest = candidates[0];

        for (
            let index = 1;
            index < candidates.length;
            index++
        ) {
            const candidate =
                candidates[index];

            if (
                comesAfter(
                    candidate,
                    closest
                )
            ) {
                closest = candidate;
            }
        }

        return closest;
    }

    // =========================================================
    // FIND NATIVE BOTTOM PAGINATION
    // =========================================================

    function findNativeBottomPagination(resultsList) {
        if (!resultsList) {
            return null;
        }

        const candidates =
            findPaginations().filter(
                (pagination) => {
                    /*
                     * Never treat our clone as AO3's
                     * native pagination.
                     */
                    if (
                        isOurPagination(
                            pagination
                        )
                    ) {
                        return false;
                    }

                    /*
                     * Native bottom pagination must be after
                     * the results list.
                     */
                    return comesAfter(
                        pagination,
                        resultsList
                    );
                }
            );

        if (!candidates.length) {
            return null;
        }

        /*
         * Use the pagination closest to the result list.
         */
        let closest = candidates[0];

        for (
            let index = 1;
            index < candidates.length;
            index++
        ) {
            const candidate =
                candidates[index];

            if (
                comesBefore(
                    candidate,
                    closest
                )
            ) {
                closest = candidate;
            }
        }

        return closest;
    }

    // =========================================================
    // FIND OUR PAGINATION
    // =========================================================

    function findOurTopPagination() {
        return document.getElementById(
            TOP_PAGINATION_ID
        );
    }

    // =========================================================
    // REMOVE OUR PAGINATION
    // =========================================================

    function removeOurTopPagination() {
        const existing =
            findOurTopPagination();

        if (existing) {
            existing.remove();
        }
    }

    // =========================================================
    // CHECK OUR PAGINATION POSITION
    // =========================================================

    function isCorrectlyPositioned(
        ourTop,
        resultsList
    ) {
        if (
            !ourTop ||
            !resultsList
        ) {
            return false;
        }

        return (
            ourTop.parentNode ===
                resultsList.parentNode &&
            ourTop.nextElementSibling ===
                resultsList
        );
    }

    // =========================================================
    // CREATE PAGINATION SIGNATURE
    // =========================================================

    function getPaginationSignature(pagination) {
        if (!pagination) {
            return '';
        }

        /*
         * We compare the meaningful structure of the
         * pagination.
         *
         * We deliberately ignore:
         *
         *   data-ao3-top-pagination
         *   aria-label
         *
         * because those are intentionally different on our
         * cloned version.
         */

        function serialize(node) {
            /*
             * Text node.
             */
            if (
                node.nodeType ===
                Node.TEXT_NODE
            ) {
                return node.textContent
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            /*
             * Ignore comments and other non-element nodes.
             */
            if (
                node.nodeType !==
                Node.ELEMENT_NODE
            ) {
                return '';
            }

            let result = '<';
            result += node.tagName.toLowerCase();

            const attributes =
                Array.from(node.attributes)
                    .filter((attribute) => {
                        return (
                            attribute.name !==
                                TOP_PAGINATION_MARKER &&
                            attribute.name !==
                                'aria-label'
                        );
                    })
                    .sort((a, b) => {
                        return a.name.localeCompare(
                            b.name
                        );
                    });

            for (
                const attribute
                of attributes
            ) {
                result +=
                    ` ${attribute.name}="${attribute.value}"`;
            }

            result += '>';

            for (
                const child
                of node.childNodes
            ) {
                result += serialize(child);
            }

            result +=
                `</${node.tagName.toLowerCase()}>`;

            return result;
        }

        return serialize(pagination);
    }

    // =========================================================
    // GET PAGINATION INSIDE OUR WRAPPER
    // =========================================================

    function getOurPaginationElement(ourTop) {
        if (!ourTop) {
            return null;
        }

        return ourTop.querySelector(
            'ol.pagination.actions'
        );
    }

    // =========================================================
    // CHECK WHETHER OUR COPY IS CURRENT
    // =========================================================

    function isOurPaginationUpToDate(
        ourTop,
        nativePagination
    ) {
        if (
            !ourTop ||
            !nativePagination
        ) {
            return false;
        }

        const ourPagination =
            getOurPaginationElement(
                ourTop
            );

        if (!ourPagination) {
            return false;
        }

        return (
            getPaginationSignature(
                ourPagination
            ) ===
            getPaginationSignature(
                nativePagination
            )
        );
    }

    // =========================================================
    // CREATE TOP PAGINATION
    // =========================================================

    function createTopPagination(
        nativePagination,
        resultsList
    ) {
        if (
            !nativePagination ||
            !resultsList
        ) {
            return;
        }

        /*
         * Final safety check:
         *
         * AO3 may have inserted its own top pagination
         * between our previous check and this function.
         */
        if (
            findNativeTopPagination(
                resultsList
            )
        ) {
            return;
        }

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
         * Clone AO3's actual pagination.
         *
         * We do NOT construct the links ourselves.
         */
        const clone =
            nativePagination.cloneNode(true);

        /*
         * Mark the clone.
         */
        clone.setAttribute(
            TOP_PAGINATION_MARKER,
            'true'
        );

        /*
         * Avoid duplicate IDs.
         */
        clone
            .querySelectorAll('[id]')
            .forEach((element) => {
                element.removeAttribute('id');
            });

        /*
         * Accessible label for the cloned navigation.
         */
        clone.setAttribute(
            'aria-label',
            'Top Pagination'
        );

        wrapper.appendChild(clone);

        /*
         * Put it immediately before the results list.
         */
        resultsList.parentNode.insertBefore(
            wrapper,
            resultsList
        );
    }

    // =========================================================
    // MAIN UPDATE LOGIC
    // =========================================================

    function updatePagination() {
        if (updating) {
            return;
        }

        updating = true;

        try {
            const resultsList =
                findResultsList();

            // -------------------------------------------------
            // No supported results list.
            // -------------------------------------------------

            if (!resultsList) {
                removeOurTopPagination();
                return;
            }

            // -------------------------------------------------
            // IMPORTANT:
            //
            // Every update checks BOTH native positions.
            // -------------------------------------------------

            const nativeTop =
                findNativeTopPagination(
                    resultsList
                );

            const nativeBottom =
                findNativeBottomPagination(
                    resultsList
                );

            const ourTop =
                findOurTopPagination();

            // -------------------------------------------------
            // CASE 1
            //
            // AO3 already provides top pagination.
            //
            // Do not duplicate it.
            // -------------------------------------------------

            if (nativeTop) {
                removeOurTopPagination();
                return;
            }

            // -------------------------------------------------
            // CASE 2
            //
            // No native top.
            // Native bottom exists.
            //
            // We need a generated top pagination.
            // -------------------------------------------------

            if (nativeBottom) {

                /*
                 * Nothing exists yet.
                 */
                if (!ourTop) {
                    createTopPagination(
                        nativeBottom,
                        resultsList
                    );

                    return;
                }

                /*
                 * Our copy is in the wrong place.
                 */
                if (
                    !isCorrectlyPositioned(
                        ourTop,
                        resultsList
                    )
                ) {
                    removeOurTopPagination();

                    createTopPagination(
                        nativeBottom,
                        resultsList
                    );

                    return;
                }

                /*
                 * Our copy is correctly positioned.
                 *
                 * Check whether AO3 changed its pagination.
                 */
                if (
                    !isOurPaginationUpToDate(
                        ourTop,
                        nativeBottom
                    )
                ) {
                    removeOurTopPagination();

                    createTopPagination(
                        nativeBottom,
                        resultsList
                    );
                }

                return;
            }

            // -------------------------------------------------
            // CASE 3
            //
            // No native top.
            // No native bottom.
            //
            // There is no valid AO3 pagination source.
            //
            // Remove any old clone so stale page links
            // cannot survive an AO3 result update.
            // -------------------------------------------------

            removeOurTopPagination();

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
    // OBSERVE AO3 CHANGES
    // =========================================================

    const observer =
        new MutationObserver(() => {
            scheduleUpdate();
        });

    observer.observe(
        document.body,
        {
            /*
             * Detect elements being added or removed.
             */
            childList: true,

            /*
             * Detect relevant attribute changes.
             */
            attributes: true,

            /*
             * Detect text changes such as:
             *
             *   <span class="current">1</span>
             *
             * becoming:
             *
             *   <span class="current">2</span>
             */
            characterData: true,

            /*
             * Watch descendants of body.
             */
            subtree: true,

            /*
             * Only attribute changes that can affect
             * pagination or its structure.
             */
            attributeFilter: [
                'href',
                'class',
                'id',
                'aria-label'
            ]
        }
    );

    // =========================================================
    // INITIAL RUN
    // =========================================================

    updatePagination();

})();
