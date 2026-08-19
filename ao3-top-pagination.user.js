// ==UserScript==
// @name         AO3 Top Pagination + Work Skin Edit + Bottom Work Edit
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Adds missing top pagination, a top Edit button to AO3 Work Skin pages, and a bottom Edit button next to AO3's ↑ Top link on work pages.
// @author       GPT-5.6 Luna
// @match        https://archiveofourown.org/tags/*/works*
// @match        https://archiveofourown.org/tags/*/works/*
// @match        https://archiveofourown.org/tags/*/bookmarks*
// @match        https://archiveofourown.org/tags/search*
// @match        https://archiveofourown.org/works/search*
// @match        https://archiveofourown.org/people/search*
// @match        https://archiveofourown.org/bookmarks/search*
// @match        https://archiveofourown.org/skins/*
// @match        https://archiveofourown.org/works/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/erguieorgyFluffy/ao3-top-pagination/main/ao3-top-pagination.user.js
// @downloadURL  https://raw.githubusercontent.com/erguieorgyFluffy/ao3-top-pagination/main/ao3-top-pagination.user.js
// ==/UserScript==

(function () {
    'use strict';

    const TOP_PAGINATION_ID =
        'ao3-top-pagination';

    const TOP_PAGINATION_MARKER =
        'data-ao3-top-pagination';

    const TOP_EDIT_ID =
        'ao3-top-workskin-edit';

    const BOTTOM_EDIT_ID =
        'ao3-bottom-work-edit';

    let paginationUpdateTimer = null;
    let editUpdateTimer = null;

    let updatingPagination = false;
    let updatingEditButtons = false;

    // =========================================================
    // GENERAL HELPERS
    // =========================================================

    function findMain() {
        return document.querySelector('#main');
    }

    function isWorkPage() {
        const main = findMain();

        return Boolean(
            main &&
            main.classList.contains('works-show')
        );
    }

    function isWorkSkinPage() {
        const main = findMain();

        return Boolean(
            main &&
            main.classList.contains('skins-show')
        );
    }

    // =========================================================
    // PAGINATION
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

    function findPaginations() {
        const main = findMain();

        if (!main) {
            return [];
        }

        /*
         * Do not depend on "pagy".
         *
         * AO3 can use:
         *
         *   pagination actions pagy
         *
         * or:
         *
         *   pagination actions
         */

        return Array.from(
            main.querySelectorAll(
                'ol.pagination.actions'
            )
        );
    }

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
                    if (
                        isOurPagination(
                            pagination
                        )
                    ) {
                        return false;
                    }

                    return comesBefore(
                        pagination,
                        resultsList
                    );
                }
            );

        if (!candidates.length) {
            return null;
        }

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
                    if (
                        isOurPagination(
                            pagination
                        )
                    ) {
                        return false;
                    }

                    return comesAfter(
                        pagination,
                        resultsList
                    );
                }
            );

        if (!candidates.length) {
            return null;
        }

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

    function removeOurTopPagination() {
        const existing =
            findOurTopPagination();

        if (existing) {
            existing.remove();
        }
    }

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
    // PAGINATION SIGNATURE
    // =========================================================

    function getPaginationSignature(pagination) {
        if (!pagination) {
            return '';
        }

        function serialize(node) {
            if (
                node.nodeType ===
                Node.TEXT_NODE
            ) {
                return node.textContent
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            if (
                node.nodeType !==
                Node.ELEMENT_NODE
            ) {
                return '';
            }

            let result =
                '<' +
                node.tagName.toLowerCase();

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

    function getOurPaginationElement(ourTop) {
        if (!ourTop) {
            return null;
        }

        return ourTop.querySelector(
            'ol.pagination.actions'
        );
    }

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
         * AO3 may have inserted native top pagination
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
         * Clone AO3's real pagination.
         */
        const clone =
            nativePagination.cloneNode(true);

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

        clone.setAttribute(
            'aria-label',
            'Top Pagination'
        );

        wrapper.appendChild(clone);

        resultsList.parentNode.insertBefore(
            wrapper,
            resultsList
        );
    }

    // =========================================================
    // UPDATE PAGINATION
    // =========================================================

    function updatePagination() {
        if (updatingPagination) {
            return;
        }

        updatingPagination = true;

        try {
            const resultsList =
                findResultsList();

            if (!resultsList) {
                removeOurTopPagination();
                return;
            }

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

            /*
             * AO3 already has top pagination.
             * Never duplicate it.
             */
            if (nativeTop) {
                removeOurTopPagination();
                return;
            }

            /*
             * AO3 has bottom pagination.
             * Mirror it at the top.
             */
            if (nativeBottom) {
                if (!ourTop) {
                    createTopPagination(
                        nativeBottom,
                        resultsList
                    );

                    return;
                }

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

            /*
             * No valid native pagination source.
             * Remove stale clone.
             */
            removeOurTopPagination();

        } finally {
            updatingPagination = false;
        }
    }

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
    // WORK SKIN TOP EDIT
    // =========================================================

    function findWorkSkinEditLink() {
        const main = findMain();

        if (!main) {
            return null;
        }

        /*
         * Work Skin pages expose the real edit link as:
         *
         * /skins/<id>/edit
         *
         * We deliberately use AO3's own link instead of
         * constructing the URL ourselves.
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

    function findOurWorkSkinEditButton() {
        return document.getElementById(
            TOP_EDIT_ID
        );
    }

    function removeWorkSkinEditButton() {
        const existing =
            findOurWorkSkinEditButton();

        if (existing) {
            existing.remove();
        }
    }

    function createWorkSkinEditButton() {
        if (!isWorkSkinPage()) {
            return;
        }

        const main = findMain();

        if (!main) {
            return;
        }

        const editLink =
            findWorkSkinEditLink();

        if (!editLink) {
            return;
        }

        const header =
            main.querySelector(
                '.primary.header.module'
            );

        if (!header) {
            return;
        }

        if (
            findOurWorkSkinEditButton()
        ) {
            return;
        }

        const wrapper =
            document.createElement('ul');

        wrapper.id =
            TOP_EDIT_ID;

        wrapper.className =
            'actions';

        const li =
            document.createElement('li');

        const clone =
            editLink.cloneNode(true);

        clone.removeAttribute('id');

        li.appendChild(clone);
        wrapper.appendChild(li);

        header.insertAdjacentElement(
            'afterend',
            wrapper
        );
    }

    function updateWorkSkinEditButton() {
        if (!isWorkSkinPage()) {
            removeWorkSkinEditButton();
            return;
        }

        const main = findMain();

        if (!main) {
            return;
        }

        const editLink =
            findWorkSkinEditLink();

        if (!editLink) {
            removeWorkSkinEditButton();
            return;
        }

        const header =
            main.querySelector(
                '.primary.header.module'
            );

        if (!header) {
            removeWorkSkinEditButton();
            return;
        }

        const existing =
            findOurWorkSkinEditButton();

        if (!existing) {
            createWorkSkinEditButton();
            return;
        }

        /*
         * Keep our button immediately after AO3's
         * skin header.
         */
        if (
            existing.parentNode !==
                header.parentNode ||
            existing.previousElementSibling !==
                header
        ) {
            existing.remove();
            createWorkSkinEditButton();
            return;
        }

        const ourLink =
            existing.querySelector('a');

        if (
            !ourLink ||
            ourLink.href !== editLink.href
        ) {
            existing.remove();
            createWorkSkinEditButton();
        }
    }

    // =========================================================
    // WORK EDIT LINK
    // =========================================================

    function findWorkEditLink() {
        const main = findMain();

        if (!main) {
            return null;
        }

        /*
         * Prefer AO3's actual top work navigation.
         */
        const navigation =
            main.querySelector(
                'ul.work.navigation.actions'
            );

        if (navigation) {
            const editLink =
                navigation.querySelector(
                    'li.edit:not(.tag) a[href]'
                );

            if (editLink) {
                try {
                    const url =
                        new URL(
                            editLink.href,
                            window.location.origin
                        );

                    if (
                        url.origin ===
                            window.location.origin &&
                        /^\/works\/\d+\/edit\/?$/.test(
                            url.pathname
                        )
                    ) {
                        return editLink;
                    }
                } catch (error) {
                    // Continue to fallback.
                }
            }
        }

        /*
         * Fallback: locate an actual AO3 work edit URL.
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
                /^\/works\/\d+\/edit\/?$/.test(
                    url.pathname
                )
            ) {
                return link;
            }
        }

        return null;
    }

    // =========================================================
    // FIND AO3'S BOTTOM ACTION LIST
    // =========================================================

    function findBottomActionList() {
        if (!isWorkPage()) {
            return null;
        }

        const main = findMain();

        if (!main) {
            return null;
        }

        /*
         * AO3's bottom action list in the supplied HTML is:
         *
         * <ul class="actions">
         *     <li><a href="#main">↑ Top</a></li>
         *     ...
         * </ul>
         *
         * We specifically require:
         *
         *   - ul.actions
         *   - an actual #main link
         *   - that #main link to be in an LI
         *
         * This avoids accidentally selecting unrelated
         * action lists.
         */
        const candidates =
            Array.from(
                main.querySelectorAll(
                    'ul.actions:not(.work.navigation)'
                )
            ).filter(
                (list) => {
                    const topLink =
                        list.querySelector(
                            ':scope > li > a[href="#main"]'
                        );

                    return Boolean(
                        topLink
                    );
                }
            );

        if (!candidates.length) {
            return null;
        }

        /*
         * If AO3 ever has more than one matching list,
         * use the one closest to the end of the work.
         */
        let closest =
            candidates[0];

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

    function findBottomTopLink() {
        const actionList =
            findBottomActionList();

        if (!actionList) {
            return null;
        }

        return actionList.querySelector(
            ':scope > li > a[href="#main"]'
        );
    }

    // =========================================================
    // BOTTOM WORK EDIT BUTTON
    // =========================================================

    function findOurBottomWorkEditButton() {
        return document.getElementById(
            BOTTOM_EDIT_ID
        );
    }

    function removeBottomWorkEditButton() {
        const existing =
            findOurBottomWorkEditButton();

        if (existing) {
            existing.remove();
        }
    }

    function isBottomEditCorrectlyPositioned(
        button,
        topLink
    ) {
        if (
            !button ||
            !topLink
        ) {
            return false;
        }

        const topItem =
            topLink.closest('li');

        if (!topItem) {
            return false;
        }

        return (
            button.parentNode ===
                topItem.parentNode &&
            button.previousElementSibling ===
                topItem
        );
    }

    function createBottomWorkEditButton() {
        if (!isWorkPage()) {
            return;
        }

        const editLink =
            findWorkEditLink();

        if (!editLink) {
            removeBottomWorkEditButton();
            return;
        }

        const topLink =
            findBottomTopLink();

        if (!topLink) {
            removeBottomWorkEditButton();
            return;
        }

        const topItem =
            topLink.closest('li');

        if (!topItem) {
            removeBottomWorkEditButton();
            return;
        }

        if (
            findOurBottomWorkEditButton()
        ) {
            return;
        }

        const editItem =
            document.createElement('li');

        editItem.id =
            BOTTOM_EDIT_ID;

        editItem.className =
            'edit';

        const clone =
            editLink.cloneNode(true);

        clone.removeAttribute('id');

        editItem.appendChild(clone);

        /*
         * Insert directly after ↑ Top.
         */
        topItem.insertAdjacentElement(
            'afterend',
            editItem
        );
    }

    function updateBottomWorkEditButton() {
        if (!isWorkPage()) {
            removeBottomWorkEditButton();
            return;
        }

        const editLink =
            findWorkEditLink();

        if (!editLink) {
            removeBottomWorkEditButton();
            return;
        }

        const topLink =
            findBottomTopLink();

        if (!topLink) {
            removeBottomWorkEditButton();
            return;
        }

        const existing =
            findOurBottomWorkEditButton();

        if (!existing) {
            createBottomWorkEditButton();
            return;
        }

        /*
         * AO3 may rebuild the action list dynamically.
         */
        if (
            !isBottomEditCorrectlyPositioned(
                existing,
                topLink
            )
        ) {
            existing.remove();
            createBottomWorkEditButton();
            return;
        }

        const ourLink =
            existing.querySelector('a');

        /*
         * Keep the clone synchronized with AO3's
         * actual Edit link.
         */
        if (
            !ourLink ||
            ourLink.href !== editLink.href
        ) {
            existing.remove();
            createBottomWorkEditButton();
        }
    }

    // =========================================================
    // EDIT BUTTON UPDATE
    // =========================================================

    function updateEditButtons() {
        if (updatingEditButtons) {
            return;
        }

        updatingEditButtons = true;

        try {
            updateWorkSkinEditButton();
            updateBottomWorkEditButton();
        } finally {
            updatingEditButtons = false;
        }
    }

    function scheduleEditUpdate() {
        clearTimeout(
            editUpdateTimer
        );

        editUpdateTimer =
            setTimeout(
                updateEditButtons,
                200
            );
    }

    // =========================================================
    // MUTATION OBSERVER
    // =========================================================

    const observer =
        new MutationObserver(
            (mutations) => {
                let paginationRelevant =
                    false;

                let editRelevant =
                    false;

                for (
                    const mutation
                    of mutations
                ) {
                    /*
                     * Added/removed DOM can affect either
                     * pagination or edit buttons.
                     */
                    if (
                        mutation.type ===
                        'childList'
                    ) {
                        paginationRelevant = true;
                        editRelevant = true;
                        break;
                    }

                    /*
                     * Only relevant attributes need to
                     * trigger a refresh.
                     */
                    if (
                        mutation.type ===
                        'attributes'
                    ) {
                        const target =
                            mutation.target;

                        if (
                            target.closest &&
                            (
                                target.closest(
                                    'ol.pagination, ' +
                                    'ol.work.index, ' +
                                    'ol.tag.index, ' +
                                    'ol.pseud.index, ' +
                                    'ol.bookmark.index'
                                )
                            )
                        ) {
                            paginationRelevant = true;
                        }

                        if (
                            target.closest &&
                            (
                                target.closest(
                                    '.works-show, .skins-show'
                                )
                            )
                        ) {
                            editRelevant = true;
                        }
                    }

                    /*
                     * Text changes can affect pagination
                     * labels such as the current page.
                     */
                    if (
                        mutation.type ===
                        'characterData'
                    ) {
                        paginationRelevant = true;
                    }
                }

                /*
                 * Pagination is only relevant when a supported
                 * result list actually exists.
                 */
                if (
                    paginationRelevant &&
                    findResultsList()
                ) {
                    schedulePaginationUpdate();
                }

                /*
                 * Edit buttons are only relevant on work/work-skin
                 * pages.
                 */
                if (
                    editRelevant &&
                    (
                        isWorkPage() ||
                        isWorkSkinPage()
                    )
                ) {
                    scheduleEditUpdate();
                }
            }
        );

    observer.observe(
        document.body,
        {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,

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

    if (
        findResultsList()
    ) {
        updatePagination();
    }

    if (
        isWorkPage() ||
        isWorkSkinPage()
    ) {
        updateEditButtons();
    }

})();
