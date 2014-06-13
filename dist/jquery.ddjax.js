/*! Deferred Dynamic PJAX - v0.1.0 - 2014-06-13
* https://github.com/lokku/ddjax
* Copyright (c) 2014 Lokku Ltd.; Licensed MIT */
(function ($, window) {
    'use strict';

    $.support.cors = true;

    var url_queue = [],
        djaxing = false,
        reqUrl,
        triggered,
        popstateUrl = '',
        $window = $(window);

    var _methods = {
        'getLinks' : function () {
            var $this = this,
                settings = $this.data('settings'),
                ignoreClass = settings.ignoreClass;

            var $groupOfLinks = (typeof ignoreClass !== 'undefined') ?
                    $this.find('a') :
                    $this.find('a:not(.' + ignoreClass + ')');

            return $groupOfLinks;
        },
        'handleClick' : function (event) {
            var $this = this,
                a = event.target,
                $a = $(a),
                aHref = $a.attr('href'),
                settings = $this.data('settings');

            if ($a.hasClass('ddJAX_internal')) {

                event.preventDefault();

                // If we're already doing djaxing, return now and silently fail
                if (djaxing) {
                    setTimeout(function() { _methods.clearDjaxing.call($this); }, 1000);
                    return $a;
                }

                // trigger asynchronous click event
                var djaxClickData = [a];
                $window.trigger('djaxClick', djaxClickData);

                // call blocking callback
                settings.onDjaxClickCallback.call($this, djaxClickData, {});

                var urlDataAttribute = settings.urlDataAttribute;
                if (typeof urlDataAttribute !== 'undefined') {
                    reqUrl = $a.data(urlDataAttribute);
                }

                if (typeof reqUrl === 'undefined') {
                    reqUrl = aHref;
                }

                triggered = false;
                _methods.navigate.call($this, {
                    url:            aHref,
                    add_to_history: true,
                    type:           'GET'
                });
            }

            return $this;
        },
        'clearDjaxing' : function () {
            var $this = this;
            djaxing = false;

            // check in the queue to see if there is something else that
            // needs to be navigated
            if (url_queue.length) {
                var url_addToHist = url_queue.pop();
                url_queue = [];

                var url = url_addToHist[0],
                    addToHistory = url_addToHist[1],
                    urlData = url_addToHist[2],
                    method = url_addToHist[3],
                    requestParameters = url_addToHist[4];

                methods.navigate.call($this, url, addToHistory, urlData, method, requestParameters);
            }
        },
        'getUrlFromHeaders' : function (defaultUrl, jqXHR) {

            var targetUrl = jqXHR.getResponseHeader("TargetUrl");

            // yes targetUrl can be null
            if (targetUrl === null || typeof targetUrl === 'undefined') {
                targetUrl = defaultUrl;
            }
            return targetUrl;
        },
        'navigate' : function (options) {
            var $this = this;

            djaxing = true;

            $window.trigger(
                'djaxLoading', [{
                    'url' : options.url
                }]
            );

            $.ajax(_methods.ajaxSettings($this, options));
        },
        'ajaxSettings' : function(element, options) {
            if (options.method !== 'POST') {
                options.method = 'GET';
            }

            options.blocks = $(element.data('djaxBlockSelector'));

            var settings = element.data('settings');

            var ajax_data = settings.ajax_data_parameter;
            if (typeof ajax_data === 'function') {
                ajax_data = ajax_data();
            }

            return {
                'url' :         options.url,
                'data' :        ajax_data,
                'timeout' :     settings.ajax_timeout,
                'type' :        options.method,
                'crossDomain' : true,
                'success' :     _methods.changePage(
                    element,
                    options.url,
                    options.add_to_history,
                    options.blocks
                ),
                'error' :       _methods.changePageError(
                    element,
                    options.url,
                    options.add_to_history,
                    options.blocks,
                    settings.ajax_timeout_callback
                )
            };
        },
        'changePage' : function (element, url, add_to_history, blocks) {

            return function (responseData, textStatus, jqXHR) {

                var targetUrl = _methods.getUrlFromHeaders.call(element, url, jqXHR);

                // keep url we are going to
                reqUrl = targetUrl;

                _methods.replaceBlocks.call(element, targetUrl, add_to_history, blocks, responseData);
            };
        },
        'changePageError' : function (element, url, add_to_history, blocks, timeout_callback) {
            return function (jqXHR, textStatus, errorThrown) {
                if (textStatus === 'error' && 
                    (jqXHR.status === 404 ||
                        errorThrown === "" ||
                        typeof jqXHR.responseText === 'undefined')) {


                    // just "browse" to the url provided to handle redirects
                    window.location.href = this.url;
                }
                else if (textStatus === 'timeout') {
                    if (typeof timeoutCallback !== 'undefined') {
                        timeout_callback(this);
                    }
                }
                else {
                    // handle error
                    // still replace blocks as we may end up here if the
                    // correct content type is not set by the webserver -
                    // (e.g., with content type set to application/json an
                    // error may be returned)

                    // try to get url from the headers
                    var targetUrl = _methods.getUrlFromHeaders.call(element, url, jqXHR);

                    // keep url we are going to
                    reqUrl = targetUrl;

                    _methods.replaceBlocks.call(element, targetUrl, add_to_history, blocks, jqXHR['responseText']);
                }
            };
        },
        'replaceBlocks' : function (url, add, currentBlocks, response) {
            var $this = this;

            var settings = $this.data('settings');

            if (url !== reqUrl) {
                _methods.navigate.call($this, {
                    url: reqUrl,
                    add_to_history: false,
                    method: 'GET'
                });
                return true;
            }

            // get some settings
            var blockSelector = $this.data('djaxBlockSelector');

            var $result = $(response);

            // add them to the history if requested
            if (add) {
                window.history.pushState(
                    {
                        'url' : url,
                        'title' : $result.filter('title').text()
                    },
                    $result.filter('title').text(),
                    url
                );
            }

            // here store all replacements to be performed
            // they look like:
            // {
            //     type: 'replace', // or prependTo, insertAfter, remove
            //     new_block: $jquery_element,
            //     target: $jquery_element, // or null if a new block needs to be removed
            // }
            //
            var replacements_config = [];

            // Set page title as new page title
            //
            // Set title cross-browser:
            // - $('title').text(title_text); returns an error on IE7
            //
            document.title = $result.filter('title').text();

            // parse new blocks (wrap reponse to obtain all the descendants)
            var $newBlocks = $('<div>' + response + '</div>').find(blockSelector);

            //
            // Case in which blocks need to be replaced
            //
            currentBlocks.each(function () {

                var $currentBlock = $(this);
                var id = '#' + $currentBlock.attr('id');
                var newBlock = $newBlocks.filter(id);

                // take all internal links in the new block
                var $linksInNewBlock;
                if (typeof settings.ignoreClass === 'undefined') {
                    $linksInNewBlock = $('a', newBlock);
                }
                else {
                    $linksInNewBlock = $('a:not(.' + settings.ignoreClass + ')', newBlock);
                }

                $linksInNewBlock
                    .filter(function () {
                        return this.hostname === location.hostname;
                    })
                    .addClass('ddJAX_internal');

                if (newBlock.length) {
                    // compare the html of the new and the current block
                    var block_html = $currentBlock.clone().wrap('<div>').parent().html(),
                        newblock_html = newBlock.clone().wrap('<div>').parent().html();

                    if (block_html !== newblock_html) {
                        replacements_config.push({
                            'type':  'replace',
                            'new_block' : newBlock,
                            'target' : $currentBlock
                        });
                    }
                    else {
                        // get rid of the new block if the html of the old
                        // block is exactly the same!
                        replacements_config.push({
                            'type': 'remove',
                            'new_block': newBlock,
                            'target' : undefined
                        });
                    }
                }
            });


            //
            // Case in which blocks need to be added/appended
            //
            var $previousBlock;

            $.each($newBlocks, function () {

                var $newBlock = $(this),
                    id = '#' + $(this).attr('id'),
                    $previousSibling;

                // If there is a new page block without an equivalent block
                // in the old page, we need to find out where to insert it
                if (!$(id).length) {

                    // Find the previous sibling
                    $previousSibling = $result.find(id).prev();

                    if ($previousSibling.length) {
                        // Insert after the previous element

                        // note here we return the id, not a jQuery object we
                        // want to evaluate this when the previous Sibling is
                        // in the dom, and it may not be there yet.
                        replacements_config.push({
                            'type' : 'insertAfter',
                            'target' : $previousSibling.attr('id'),
                            'new_block' : $newBlock
                        });
                    } else {
                        // There's no previous sibling, so prepend to parent instead
                        var parent_id = $newBlock.parent().attr('id');
                        if (parent_id === undefined && $previousBlock !== undefined) {

                            replacements_config.push({
                                'type' : 'insertAfter',
                                'target' : $previousBlock.attr('id'), 
                                'new_block' : $newBlock
                            });
                        }
                        else {
                            replacements_config.push({
                                'type' : 'prependTo',
                                'target' : $('#' + parent_id),
                                'new_block' : $newBlock
                            });
                        }
                    }
                }

                // Keep the previous block
                $previousBlock = $newBlock;

                var replace_fn = function ($newBlock) {
                    var $links;
                    if (typeof settings.ignoreClass === 'undefined') {
                        $links = $('a', $newBlock);
                    }
                    else {
                        $links = $('a:not(.' + settings.ignoreClass + ')', $newBlock);
                    }

                    $links
                        .filter(function () {
                            return this.hostname === location.hostname;
                        })
                        .addClass('ddJAX_internal');
                };

                replacements_config.push({
                    'type' : 'function',
                    'target': replace_fn,
                    'args' : [$newBlock]
                });

            });

            // Delegate block replacement

            var done_fn = function () {
                // Trigger djaxLoad event as a pseudo ready()
                if (!triggered) {
                    $(window).trigger(
                        'djaxLoad',
                        [{
                            'url' : url,
                            'title' : $result.filter('title').text(),
                            'response' : response
                        }]
                    );
                    triggered = true;
                    djaxing = false;
                }
            };

            replacements_config.push({
                'type' : 'function',
                'target': done_fn,
                'args' : []
            });

            $window.trigger(
                'djaxDeferReplacements',
                [ replacements_config ]
            );
        }
    };

    var methods = {
        'init' : function (options) {

            var settings = $.extend({
                'selector' : undefined,
                'ignoreClass' : undefined,
                'urlDataAttribute' : undefined,
                'ajax_data_parameter' : { },
                'ajax_timeout': undefined,
                'ajax_timeout_callback' : undefined,
                /*
                 * Called synchronously before ajax call starts.
                 *
                 * - djaxClickData: element or identifier of element the
                 *   user interacted with;
                 *
                 * - requestParameters: parameters that will be included in the
                 *   ajax call. This is an object.
                 */
                'onDjaxClickCallback' : function (/* djaxClickData, requestParameters */) { return; },
                'onHistoryPopStateCallback' : function () { return; }
            }, options);

            return this.each(function() {
                var $this = $(this);

                // save settings
                $this.data('settings', settings);

                // If browser doesn't support pushState, abort now
                if (!history.pushState) {
                    return $(this);
                }

                djaxing = false;

                var blockSelector = settings.selector;

                // Save block selector internally so that we can use it in later calls
                $this.data('djaxBlockSelector', blockSelector);

                // Ensure that the history is correct when going from 2nd page to 1st
                window.history.replaceState(
                    {
                        'url' : window.location.href,
                        'title' : $('title').text()
                    },
                    $('title').text(),
                    window.location.href
                );

                _methods.getLinks.call($this)
                    .filter(function () {
                        return this.hostname === location.hostname;
                    })
                    .addClass('ddJAX_internal');

                // On new page load
                $window.bind('popstate', function (event) {
                    triggered = false;

                    if (event.originalEvent.state) {
                        var targetUrl = event.originalEvent.state.url;

                        // prevent IE <= 9 to navigate repeatedly to the current url
                        var url_parts = targetUrl.split("#"),
                            url_parts_length = url_parts.length;

                        if (url_parts_length >= 2) {
                            // compare the last two parts
                            if (url_parts[url_parts_length-2].indexOf(url_parts[url_parts_length-1])) {
                                popstateUrl = '';
                                return;
                            }
                        }

                        if (popstateUrl !== targetUrl) {
                            settings.onHistoryPopStateCallback();
                            reqUrl = targetUrl;
                            popstateUrl = targetUrl;

                            _methods.navigate.call($this, {
                                url:            popstateUrl,
                                add_to_history: false,
                                method:         'GET'
                            });
                        }
                        else {
                            // second time just reset the popstate url.
                            popstateUrl = '';
                        }
                    }
                });

                $this.bind('click.ddjax', function (e) {
                    _methods.handleClick.call($this, e);
                });

            });
        },
        'is_djaxing' : function () {
            return djaxing;
        },
        'navigate' : function (url, add_to_history, data, method, requestParameters) {
            var $this = this;

            if (typeof data === 'undefined') {
                data = [];
            }

            if (djaxing) {
                // push url in the queue and handle once the previous ajax
                // request has completed
                url_queue.push([url, add_to_history, data, method, requestParameters]);

                // handle queue
                setTimeout(function () {
                    _methods.clearDjaxing.call($this);
                } , 1000);
                return $this;
            }
            else {
                triggered = false;
                $window.trigger('djaxClick', data);

                // call blocking callback
                var settings = $this.data('settings');
                settings.onDjaxClickCallback.call($this, data, requestParameters);

                reqUrl = url;
                _methods.navigate.call($this, {
                    url:            url,
                    add_to_history: add_to_history,
                    method:         method
                });
            }
        },
        'set_ajax_data_parameter' : function (ajax_parameters_func_or_obj) {
            var $this = this;
            var settings = $this.data('settings');

            // if function: will be called when needed; if object: will be
            // passed straight away to the $.ajax call.
            settings.ajax_data_parameter = ajax_parameters_func_or_obj;

            // save parameters
            $this.data('settings', settings);
        }
    };

    $.fn.ddjax = function(method) {
        /*
         * Just a router for method calls
         */
        if (methods[method]) {
            // call a method
            return methods[method].apply(this,
                Array.prototype.slice.call(arguments, 1)
            );
        }
        else if (typeof method === 'object' || !method) {
            // call init, user passed the settings as parameters
            return methods.init.apply(this, arguments);
        }
        else {
            $.error('Cannot call method ' + method);
        }

    };

}(jQuery, window));
