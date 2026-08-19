// ==UserScript==
// @name         AO3 Top Pagination + Work Skin Edit Button
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Adds missing top pagination to AO3 result lists and a convenient top Edit button to AO3 Work Skin pages.
// @author       GPT-5.6 Luna
// @match        https://archiveofourown.org/tags/*/works*
// @match        https://archiveofourown.org/tags/*/works/*
// @match        https://archiveofourown.org/tags/*/bookmarks*
// @match        https://archiveofourown.org/tags/search*
// @match        https://archiveofourown.org/works/search*
// @match        https://archiveofourown.org/people/search*
// @match        https://archiveofourown.org/bookmarks/search*
// @match        https://archiveofourown.org/skins/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/erguieorgyFluffy/ao3-top-pagination/main/ao3-top-pagination.user.js
// @downloadURL  https://raw.githubusercontent.com/erguieorgyFluffy/ao3-top-pagination/main/ao3-top-pagination.user.js
// ==/UserScript==

(function () {
    'use strict';

    const TOP_PAGINATION_ID = 'ao3-top-pagination';
    const TOP_PAGINATION_MARKER = 'data-ao3-top-pagination';

    const TOP_EDIT_ID = 'ao3-top-workskin-edit';

    let paginationUpdateTimer = null;
    let editUpdateTimer = null;

    let updatingPagination = false;
    let updatingEditButton = false;

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
         * Tag pages can have:
         *
         *   class="pagination actions pagy"
         *
         * while bookmark pages can have:
         *
         *   class="pagination actions"
         *
         * Therefore we intentionally use the stable
         * pagination/actions portion.
         */

        return Array.from(
            main.querySelectorAll(
                'ol.pagination.actions'
            )
        );
    }

    // =========================================================
    // IDENTIFY OUR PAGINATION
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
    // WORK SKIN PAGE DETECTION
    // =========================================================

    function isWorkSkinPage() {
        const main = findMain();

        if (!main) {
            return false;
        }

        /*
         * Individual AO3 skin display pages use:
         *
         *   <div id="main" class="skins-show ...">
         *
         * This excludes:
         *
         *   /skins/new
         *   /skins/.../edit
         *   My Work Skins
         *   My Site Skins
         */
        return main.classList.contains(
            'skins-show'
        );
    }

    // =========================================================
    // FIND THE ACTUAL WORK SKIN EDIT LINK
    // =========================================================

    function findWorkSkinEditLink() {
        const main = findMain();

        if (!main) {
            return null;
        }

        /*
         * Search all links rather than relying on a particular
         * surrounding <ul>, because AO3's markup can change
         * without changing the actual Edit URL.
         *
         * We require:
         *
         *   /skins/<numeric-id>/edit
         *
         * and require it to be same-origin.
         */
        const links =
            Array.from(
                main.querySelectorAll(
                    'a[href]'
                )
            );

        for (
            const link
            of links
        ) {
            let url;

            try {
                url = new URL(
                    link.href,
                    window.location.origin
                );
            } catch (error) {
                continue;
            }

            if (
                url.origin !==
                window.location.origin
            ) {
                continue;
            }

            if (
                /^\/skins\/\d+\/edit\/?$/.test(
                    url.pathname
                )
            ) {
                return link;
            }
        }

        return null;
    }

    // =========================================================
    // FIND OUR WORK SKIN EDIT BUTTON
    // =========================================================

    function findOurWorkSkinEditButton() {
        return document.getElementById(
            TOP_EDIT_ID
        );
    }

    // =========================================================
    // REMOVE OUR WORK SKIN EDIT BUTTON
    // =========================================================

    function removeWorkSkinEditButton() {
        const existing =
            findOurWorkSkinEditButton();

        if (existing) {
            existing.remove();
        }
    }

    // =========================================================
    // CHECK WORK SKIN EDIT BUTTON POSITION
    // =========================================================

    function isWorkSkinEditButtonCorrectlyPositioned(
        button,
        header
    ) {
        if (
            !button ||
            !header
        ) {
            return false;
        }

        return (
            button.parentNode ===
                header.parentNode &&
            button.previousElementSibling ===
                header
        );
    }

    // =========================================================
    // CREATE WORK SKIN EDIT BUTTON
    // =========================================================

    function createWorkSkinEditButton() {
        const main = findMain();

        if (!main) {
            return;
        }

        if (!isWorkSkinPage()) {
            return;
        }

        /*
         * Don't create duplicates.
         */
        if (
            findOurWorkSkinEditButton()
        ) {
            return;
        }

        /*
         * Use AO3's actual Edit link.
         *
         * If there is no Edit link, the current user does
         * not have an Edit action available, so nothing is
         * added.
         */
        const editLink =
            findWorkSkinEditLink();

        if (!editLink) {
            return;
        }

        /*
         * Find AO3's skin header.
         */
        const header =
            main.querySelector(
                '.primary.header.module'
            );

        if (!header) {
            return;
        }

        /*
         * Create a normal AO3 action list.
         */
        const wrapper =
            document.createElement('ul');

        wrapper.id =
            TOP_EDIT_ID;

        wrapper.className =
            'actions';

        /*
         * Sticky positioning keeps Edit available while
         * scrolling through thousands of lines of CSS.
         *
         * No forced background color is used, so this won't
         * create a white bar on dark/custom AO3 themes.
         */
        wrapper.style.cssText = [
            'position: sticky',
            'top: 10px',
            'z-index: 1000',
            'margin: 0 0 1em 0',
            'padding: 0.5em 0',
            'box-sizing: border-box'
        ].join(';');

        /*
         * Clone AO3's actual Edit link.
         */
        const li =
            document.createElement('li');

        const clone =
            editLink.cloneNode(true);

        /*
         * Avoid duplicate IDs.
         */
        clone.removeAttribute('id');

        li.appendChild(clone);
        wrapper.appendChild(li);

        /*
         * Place immediately below the skin header.
         */
        header.insertAdjacentElement(
            'afterend',
            wrapper
        );
    }

    // =========================================================
    // UPDATE WORK SKIN EDIT BUTTON
    // =========================================================

    function updateWorkSkinEditButton() {
        if (updatingEditButton) {
            return;
        }

        updatingEditButton = true;

        try {
            /*
             * Not an individual Work Skin page.
             */
            if (!isWorkSkinPage()) {
                removeWorkSkinEditButton();
                return;
            }

            const header =
                findMain()?.querySelector(
                    '.primary.header.module'
                );

            if (!header) {
                removeWorkSkinEditButton();
                return;
            }

            const editLink =
                findWorkSkinEditLink();

            /*
             * No actual Edit link means the user cannot edit
             * this skin, so remove any stale copy.
             */
            if (!editLink) {
                removeWorkSkinEditButton();
                return;
            }

            let existing =
                findOurWorkSkinEditButton();

            /*
             * Create if missing.
             */
            if (!existing) {
                createWorkSkinEditButton();
                return;
            }

            /*
             * If AO3 moved/rebuilt the header, put our button
             * back in the correct place.
             */
            if (
                !isWorkSkinEditButtonCorrectlyPositioned(
                    existing,
                    header
                )
            ) {
                existing.remove();

                createWorkSkinEditButton();
                return;
            }

            const ourLink =
                existing.querySelector(
                    'a'
                );

            /*
             * Something removed/replaced our copied link.
             */
            if (!ourLink) {
                existing.remove();

                createWorkSkinEditButton();
                return;
            }

            /*
             * Keep the copied URL synchronized with AO3's
             * actual Edit link.
             */
            if (
                ourLink.href !==
                editLink.href
            ) {
                existing.remove();

                createWorkSkinEditButton();
            }

        } finally {
            updatingEditButton = false;
        }
    }

    // =========================================================
    // PAGINATION UPDATE
    // =========================================================

    function updatePagination() {
        if (updatingPagination) {
            return;
        }

        updatingPagination = true;

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
            // -------------------------------------------------

            removeOurTopPagination();

        } finally {
            updatingPagination = false;
        }
    }

    // =========================================================
    // DEBOUNCE PAGINATION
    // =========================================================

    function schedulePaginationUpdate() {
        clearTimeout(
            paginationUpdateTimer
        );

        paginationUpdateTimer =
            setTimeout(
                updatePagination,
                200
            );
    }

    // =========================================================
    // DEBOUNCE EDIT BUTTON
    // =========================================================

    function scheduleEditUpdate() {
        clearTimeout(
            editUpdateTimer
        );

        editUpdateTimer =
            setTimeout(
                updateWorkSkinEditButton,
                200
            );
    }

    // =========================================================
    // MUTATION HELPERS
    // =========================================================

    function mutationIsInsideOurElements(mutation) {
        /*
         * Ignore mutations whose target is our own injected
         * pagination or Edit button.
         *
         * This prevents our own DOM changes from needlessly
         * triggering another complete update cycle.
         */

        if (
            mutation.target instanceof Element &&
            (
                mutation.target.closest(
                    `#${TOP_PAGINATION_ID}`
                ) ||
                mutation.target.closest(
                    `#${TOP_EDIT_ID}`
                )
            )
        ) {
            return true;
        }

        /*
         * Also check added nodes. This catches mutations
         * where AO3 inserts/replaces something containing
         * one of our generated elements.
         */
        for (
            const node
            of mutation.addedNodes
        ) {
            if (
                node instanceof Element &&
                (
                    node.id === TOP_PAGINATION_ID ||
                    node.id === TOP_EDIT_ID ||
                    node.closest(
                        `#${TOP_PAGINATION_ID}`
                    ) ||
                    node.closest(
                        `#${TOP_EDIT_ID}`
                    )
                )
            ) {
                return true;
            }
        }

        return false;
    }

    // =========================================================
    // OBSERVE AO3 CHANGES
    // =========================================================

    const observer =
        new MutationObserver(
            (mutations) => {
                let relevantChange = false;

                for (
                    const mutation
                    of mutations
                ) {
                    if (
                        mutationIsInsideOurElements(
                            mutation
                        )
                    ) {
                        continue;
                    }

                    relevantChange = true;
                    break;
                }

                if (!relevantChange) {
                    return;
                }

                /*
                 * Pagination and Work Skin handling are
                 * scheduled independently.
                 */
                schedulePaginationUpdate();
                scheduleEditUpdate();
            }
        );

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
             * Only attributes relevant to the two features.
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
    updateWorkSkinEditButton();

})();
