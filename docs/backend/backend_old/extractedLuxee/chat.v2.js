jQuery.fn.onPositionChanged = function (trigger, millis) {
    if (millis == null) millis = 100;
    var o = $(this[0]); // our jquery object
    if (o.length < 1) return o;

    var lastPos = null;
    var lastOff = null;
    setInterval(function () {
        if (o == null || o.length < 1) return o; // abort if element is non existend eny more
        if (lastPos == null) lastPos = o.position();
        if (lastOff == null) lastOff = o.offset();
        var newPos = o.position();
        var newOff = o.offset();
        if (lastPos.top != newPos.top || lastPos.left != newPos.left) {
            $(this).trigger('onPositionChanged', { lastPos: lastPos, newPos: newPos });
            if (typeof (trigger) == "function") trigger(lastPos, newPos);
            lastPos = o.position();
        }
        if (lastOff.top != newOff.top || lastOff.left != newOff.left) {
            $(this).trigger('onOffsetChanged', { lastOff: lastOff, newOff: newOff});
            if (typeof (trigger) == "function") trigger(lastOff, newOff);
            lastOff= o.offset();
        }
    }, millis);

    return o;
};

function ModelChatInstance(
    profilesData,
    templates,
    chatToken,
    apiToken,
    property,
    s3Host,
    notifySelector,
    soundSrc,
    winkExclude,
    urls,
    activityToken,
    stickers
) {
    var main = {
            container: $(templates.mainContainer)
        },
        profiles = {
            data: profilesData,
            lastNewCountUpdateTime: 0,
            outer: {},
            container: $(templates.profilesContainer),
            active: null,
            disconnectedProfiles: [],
            loaded: [],
            notifyWrap: $(notifySelector)
        },
        chats = {
            data: {},
            filters: {},
            settings: { winkExclude: winkExclude },
            container: $(templates.chatsContainer),
            list: {},
            active: null,
            counters: {},
        },
        chat = {
            data: {},
            list: {},
            active: null,
            container: $(templates.chatContainer),
            titleContainer: $(templates.chatTitleWrap),
            disconnectedChats: [],
        },
        input = {
            container: $(templates.inputContainer),
            emoji: null,
            data: {},
            disabled: false,
            editable: {},
            communicationFiles: {}
        },
        info = {
            data: {},
            container: $(templates.infoContainer),
            property: property
        },
        comments = {
            data: {},
            container: $(templates.commentsContainer),
            active: {}
        },
        profileMedia = {
            data: {},
            container: $(templates.profileMediaContainer),
            active: {}
        },
        media = {
            data: {},
            container: $(templates.mediaContainer),
            active: {},
            loadMore: {}
        },
        socket = {
            token: chatToken,
            instance: null,
            isConnected: false,
            isAuthorized: false
        },
        tasks = {
            data: {
                activeTask: null,
                tasks: {},
                page: null,
                load: false
            },
            active: false,
            users: {}
        },
        template = {
            emptyContainer: templates.emptyContainer,
            profileEmptyContainer: templates.profileEmptyContainer,
            profileContainer: templates.profileContainer,
            lockContainer: templates.lockContainer,
            errorTemplateContainer: templates.errorTemplateContainer,
            brokeContainer: templates.brokeContainer,
            preloadTemplateContainer: templates.preloadTemplateContainer,
            smallPreloadTemplateContainer: templates.smallPreloadTemplateContainer,
            chatTemplate: templates.chatTemplate,
            chatContainer: templates.chatContainer,
            chatTitleWrap: templates.chatTitleWrap,
            messageOwnerTemplate: templates.messageOwnerTemplate,
            messageOpponentTemplate: templates.messageOpponentTemplate,
            inputFieldTemplate: templates.inputFieldTemplate,
            inputFieldId: templates.inputFieldId,
            inputFileFieldId: templates.inputFileFieldId,
            inputDisappearedFileFieldId: templates.inputDisappearedFileFieldId,
            typingWrapTemplate: templates.typingWrapTemplate,
            inputErrorTemplate: templates.inputErrorTemplate,
            chatTitleTemplate: templates.chatTitleTemplate,
            dateLineTemplate: templates.dateLineTemplate,
            infoWrapTemplate: templates.infoWrapTemplate,
            fileSelectWrapId: templates.fileSelectWrapId,
            fileSelectTemplate: templates.fileSelectTemplate,
            mediaPreviewTemplate: templates.mediaPreviewTemplate,
            mediaVideoPreviewTemplate: templates.mediaVideoPreviewTemplate,
            messageMediaOwnerTemplate: templates.messageMediaOwnerTemplate,
            messageMediaOpponentTemplate: templates.messageMediaOpponentTemplate,
            modalViewVideo: templates.modalViewVideo,
            playerTemplate: templates.playerTemplate,
            fileMessageUpload: templates.fileMessageUpload,
            modalCommunicationFiles: templates.modalCommunicationFiles,
            communicationPhotoTemplate: templates.communicationPhotoTemplate,
            communicationVideoTemplate: templates.communicationVideoTemplate,
            commentsNewFormTemplate: templates.commentsNewFormTemplate,
            commentsNewFormWrap: templates.commentsNewFormWrap,
            commentsFormMessageWrap: templates.commentsFormMessageWrap,
            commentsNewForm: templates.commentsNewForm,
            commentsMessageTemplate: templates.commentsMessageTemplate,
            commentsMessageLoadMoreTemplate: templates.commentsMessageLoadMoreTemplate,
            mediaFilesImgTemplate: templates.mediaFilesImgTemplate,
            mediaFilesVideoTemplate: templates.mediaFilesVideoTemplate,
            profileMediaVideoTemplate: templates.profileMediaVideoTemplate,
            profileMediaPhotoTemplate: templates.profileMediaPhotoTemplate,
            mediaMessageLoadMoreTemplate: templates.mediaMessageLoadMoreTemplate,
            messageGiftOwnerTemplate: templates.messageGiftOwnerTemplate,
            messageGiftOpponentTemplate: templates.messageGiftOpponentTemplate,
            messageGiftBodyTemplate: templates.messageGiftBodyTemplate,
            postcardTemplate: templates.postcardTemplate,
            messageHistoryTemplate: templates.messageHistoryTemplate,
            messageHistoryRowTemplate: templates.messageHistoryRowTemplate,
            messageStickerOwnerTemplate: templates.messageStickerOwnerTemplate,
            messageStickerTemplate: templates.messageStickerTemplate,
            messageStickerBodyTemplate: templates.messageStickerBodyTemplate,
            messageDisappearedPhotoOwnerTemplate: templates.messageDisappearedPhotoOwnerTemplate,
            messageDisappearedVideoOwnerTemplate: templates.messageDisappearedVideoOwnerTemplate,
            messageDisappearedPhotoOpponentTemplate: templates.messageDisappearedPhotoOpponentTemplate,
            messageDisappearedVideoOpponentTemplate: templates.messageDisappearedVideoOpponentTemplate,
            mediaDisappearedVideoPreviewTemplate: templates.mediaDisappearedVideoPreviewTemplate,
            mediaDisappearedPhotoPreviewTemplate: templates.mediaDisappearedPhotoPreviewTemplate,
            messageDisappearedVideoExpiredOpponentTemplate: templates.messageDisappearedVideoExpiredOpponentTemplate,
            messageDisappearedVideoExpiredOwnerTemplate: templates.messageDisappearedVideoExpiredOwnerTemplate,
            profileCatchUp: templates.profileCatchUp,
            chatTaskTemplate: templates.chatTaskTemplate,
            skipTaskFormTemplate: templates.skipTaskFormTemplate
        },
        error = {
            container: $(templates.errorContainer)
        },
        weekDayShort = ['Sun', 'Mon', 'Tu', 'Wed', 'Th', 'Fri', 'Sat'],
        monthFull = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'],
        queryParams = {},
        profileSliderInitStatus = 0,
        newChat = {
            container: $('#newChatModal'),
            selectProfileContainer: $('#newChatSelectProfileModal'),
            modal: null,
            isInitialized: false,
            data: {},
        },
        projectProfiles = {},
        prevSelectProfile = null;
    var SKIP_TASK_REASON_MISSMATCH = 1;
    var SKIP_TASK_REASON_NOT_ACTIVE = 2;
    var SKIP_TASK_REASON_OTHER = 3;
    var SKIP_TASK_REASON_MESSAGE_LIMIT_REACHED = 4;
    var skipTaskReasons = [
        {
            value: SKIP_TASK_REASON_MISSMATCH,
            text: 'Missmatch'
        },
        {
            value: SKIP_TASK_REASON_NOT_ACTIVE,
            text: 'Non-active user'
        },
        {
            value: SKIP_TASK_REASON_MESSAGE_LIMIT_REACHED,
            text: 'Message limit reached'
        },
        {
            value: SKIP_TASK_REASON_OTHER,
            text: 'Other'
        }
    ];

    var GENDER_MALE = 1,
        GENDER_FEMALE = 2,
        MESSAGE_TYPE_WINK = 3,
        MESSAGE_TYPE_GIFT = 4,
        MESSAGE_TYPE_MEDIA = 2,
        MESSAGE_TYPE_TEXT = 1,
        MESSAGE_TYPE_POSTCARD = 7,
        MESSAGE_TYPE_VIRTUAL_GIFT = 5,
        MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST = 6,
        MESSAGE_TYPE_STICKER = 8,
        MESSAGE_TYPE_DISAPPEARING_PHOTO = 9,
        MESSAGE_TYPE_DISAPPEARING_VIDEO = 10,
        TYPE_PHOTO = 1,
        TYPE_VIDEO = 2,
        MESSAGE_DELIVERY_SEND = 1,
        MESSAGE_DELIVERY_DELIVERED = 2,
        MESSAGE_DELIVERY_BROKE = 5,
        MESSAGE_STATUS_UNREAD = 1,
        MESSAGE_STATUS_READ = 2,
        MESSAGE_STATUS_DELETED = 4,
        MESSAGE_STATUS_EXPIRED = 5,
        MESSAGE_STATUS_FULLY_EXPIRED = 6,
        MAX_MESSAGE_SYMBOLS = 200,
        CHAT_UPLOAD_MAX_FILES = 5,
        CHAT_MAX_DISAPPEARED_FILES = 1,
        UPLOAD_IMAGE_FILE_FORMATS = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/bmp'],
        UPLOAD_VIDEO_FILE_FORMATS = ['video/mp4', 'video/mpeg', 'video/3gp', 'video/x-msvideo', 'video/quicktime',
            'application/octet-stream'
        ],
        CHAT_UPLOAD_VIDEO_EXTENSION = ['3gp', 'mp4', 'm4a', 'wav', 'ogg', 'mov', 'avi'],
        CHAT_UPLOAD_MAX_IMAGE_FILE_SIZE = 15728640,
        CHAT_UPLOAD_MAX_VIDEO_FILE_SIZE = 52428800,
        FILE_STATUS_DELETED = 3,
        FILE_STATUS_SEND = 5,
        FILE_STATUS_PROCESSING = 6,
        FILE_STATUS_ERROR = 9,
        FILE_STATUS_UPLOADED = 7,
        FILE_STATUS_SAVED = 1,
        CHANEL_NOT_FAVORITE = 1,
        CHANEL_FAVORITE = 2,
        WINK_EXCLUDE = 1,
        WINK_SHOW = 2,
        PURCHASE_TYPE_FREE = 1,
        PURCHASE_TYPE_PAYED = 2,
        API_RESPONSE_STATUS_NOT_VALID_DATA = 422,
        API_RESPONSE_STATUS_NOT_AUTH = 401,
        MEDIA_FILES_LIMIT = 50,
        MEDIA_ACCESS_TYPE_PRIVATE = 1,
        MEDIA_ACCESS_TYPE_PUBLIC = 0,
        CHANNEL_STATUS_HIDDEN = 1,
        CHANNEL_STATUS_ACTIVE = 2,
        CHANNEL_STATUS_DELETED = 3,
        CHANNEL_STATUS_BANNED = 4,
        lastActivityIntervalHandler = null,
        lastActivityTime = null,
        maxLastActivityTimeout = 30 * 60 * 1000,
        lastActivityStartReconnect = false,
        URL_OWNER_UID_PARAMETER = 'ownerUid',
        URL_PROFILE_UID_PARAMETER = 'profileUid',
        URL_USER_UID_PARAMETER = 'userUid',
        RESPONSIVE_FROM_WIDTH = 990,
        SLICK_SLIDER_START_INIT = 1,
        SLICK_SLIDER_INITIALIZED = 2,
        USER_VERIFIED = 1,
        BALANCE_FREE_FOR_SEND_FILE_LIMIT = 9,
        GIFT_ACTION_TYPE_SEND = 1,
        GIFT_ACTION_TYPE_REQUEST = 2,
        GIFT_STATUS_NEW = 1,
        GIFT_STATUS_OPENED = 2,
        ACTIVITY_WINK = 3,
        WINK_AVAILABLE = 10,
        PREFER_GENDER_MALE = 1,
        PREFER_GENDER_FEMALE = 2,
        PREFER_GENDER_BOTH = 3;
    var COOKIE_IS_WEBP_COMPATIBLE = '_lx_webp';
    var ImgWebp = '/images/ts.webp';
    var DISAPPEARING_MEDIA_STATUS_NOT_USED = 0; // default value for non-disappearing media
    var DISAPPEARING_MEDIA_STATUS_NEW = 1; // 3 hours for user to open
    var DISAPPEARING_MEDIA_STATUS_OPENED = 2; // 10 minutes for user to see before expire
    var DISAPPEARING_MEDIA_STATUS_USER_EXPIRED = 3;
    var DISAPPEARING_MEDIA_STATUS_TRANSLATOR_EXPIRED = 4;
    var DISAPPEARING_MEDIA_STATUS_SUPPORT_EXPIRED = 5;
    var disappearedMediaCheckInterval = null;
    var USER_TYPE_USER = 10;
    var USER_TYPE_PROFILE = 2;
    var TASK_STATUS_ACTIVE = 1;
    var TASK_STATUS_DISABLED = 0;
    var FAVOURITES_LIMIT = 20;
    var FAVOURITES_LIMIT_TITLE = 'This profile already has 20 users in favourites. Remove someone to add a new one.';

    var eventAddProfilesToView = new CustomEvent('profilesInited');

    socket.initSocket = function (restart) {
        if (typeof Chat === 'undefined'){
            return;
        }

        parseQueryParams();

        if (restart && socket.instance) {
            socket.instance.closeConnection();
        }

        socket.instance = new Chat({
            ioInstance: io,
            path: '/chat/socket.io',
            type: 'model',
            debug: false,
            token: socket.token,
            inited: restart ? true : null
        });

        socket.instance.connect();

        socket.instance.authError = function() {
            socket.isConnected = false;
            socket.isAuthorized = false;

            profiles.lockWrap();
            chats.lockWrap();
            chat.lockWrap();
            info.lockWrap();
            comments.lockWrap();
            input.lockWrap();

            error.addErrorAlert('Permission denied.', 3000);
        };

        socket.instance.connectionError = function() {
            console.error('connectionError');
            socket.isConnected = false;
            main.brokenConnection();
            profiles.unLockWrap();
            chats.unLockWrap();
            chat.unLockWrap();
            info.unLockWrap();
            comments.unLockWrap();
        };

        /**
         * Event after connection was broken
         */
        socket.instance.afterDisconnect = function() {
            if (!socket.isAuthorized)
                return;

            socket.isConnected = false;
            main.brokenConnection();
            profiles.setDisconnectedProfiles();
            chat.setDisconnectedChats();
            input.disableInput();
        };

        /**
         * Model successfully authorized
         */
        socket.instance.afterConnect = function(data) {
            profiles.removePreloader();
            if (!data || !data.status) {
                socket.isConnected = false;
                socket.isAuthorized = false;

                addEmpty(profiles.container, {text: 'Can\'t get profile list. Please try again later.'});
                return;
            }

            socket.isConnected = true;
            socket.isAuthorized = true;
            main.restartConnection();
            profiles.unLockWrap();
            chats.unLockWrap();
            chat.unLockWrap();
            info.unLockWrap();
            comments.unLockWrap();

            profiles.initModelProfiles();
            input.enableInput();
        };

        socket.instance.afterReconnect = function() {
            var active = profiles.getActive();
            var activeChat = chats.getActive();

            if (active) {
                profiles.removeDisconnectedProfiles(active.inner.uid);
            }

            if (active && activeChat) {
                chat.removeDisconnectedChats(activeChat.identity);
                chat.getNewbieChatMessages(active.inner.uid, activeChat.identity);
                media.getNewbieMediaFiles(active.inner.uid, activeChat.identity);
            }

            profiles.getNewbieProfileChannels();
            profiles.getUpdatedProfileChannels();
        };

        socket.instance.afterCountNewModelMessageReceived = function(message) {
            var data = message.message,
                time = message.time,
                totalCount = 0;

            if (time < profiles.lastNewCountUpdateTime) {
                return;
            }

            profiles.lastNewCountUpdateTime = time;

            if (profiles.data && Object.keys(profiles.data).length > 0) {
                Object.keys(profiles.data).forEach(function (key) {
                    profiles.data[key].newMessages = 0;
                });
            }

            if (data && Object.keys(data).length > 0) {
                Object.keys(data).forEach(function (uid) {
                    if (!isUndefined(profiles.outer[uid]) && !isUndefined(profiles.data[profiles.outer[uid].import_uid])) {
                        profiles.data[profiles.outer[uid].import_uid].newMessages += data[uid].count;
                        totalCount += data[uid].count;
                        profiles.addNewMessages(profiles.outer[uid].import_uid, profiles.data[profiles.outer[uid].import_uid].newMessages);

                        if (data[uid].count > 0) {
                            var newActivity = Math.floor((new Date()).getTime() / 1000);
                            profiles.data[profiles.outer[uid].import_uid].lastActivity = (
                                !profiles.data[profiles.outer[uid].import_uid].lastActivity ||
                                profiles.data[profiles.outer[uid].import_uid].lastActivity <= newActivity
                            ) ? newActivity : profiles.data[profiles.outer[uid].import_uid].lastActivity;
                        }
                    }
                });
            }

            addCountNew(totalCount);
            profiles.sortProfileByActivity(true);
        };

        socket.instance.afterUserOpenedGift = function (data) {
            if (!data.channel) {
                return;
            }

            chat.updateChatMessage(data.channel.identity, data);
        };

        socket.instance.messageDelivered = function (channel, data) {
            var key = null;

            if (data.message.type === MESSAGE_TYPE_WINK) {
                key = data.request && data.request.key ? data.request.key : null;
            } else {
                if (
                    !isUndefined(data.request.data) &&
                    !isUndefined(data.request.data) &&
                    !isUndefined(data.request.data.key)
                ) {
                    key = data.request.data.key;
                }
            }

            // tasks.updateTaskChannel(channel);

            if (!chats.isChatActualByFilterOrSettings(channel, true, true)) {
                return;
            }

            chat.setChatMessages(channel.identity, [data.message], false, key, data.message.sid);
            chat.scrollAfterNewMessageReceived();

            if (!chats.getActive() || channel.identity !== chats.getActive().identity) {
                return;
            }

            if ([MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST, MESSAGE_TYPE_VIRTUAL_GIFT].indexOf(data.message.type) >= 0) {
                input.checkVirtualGift();
            } else if (data.message.type === MESSAGE_TYPE_STICKER) {
                input.checkSticker();
            }
        };

        socket.instance.messageDeliveredError = function (channel, message, error) {
            chat.messageDeliveryError(channel, message, error);

            if (
                [MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST, MESSAGE_TYPE_VIRTUAL_GIFT].indexOf(message.type) >= 0 &&
                chats.getActive() &&
                channel.identity === chats.getActive().identity
            ) {
                input.checkVirtualGift();
            }
        };

        socket.instance.afterNewMessage = function (channel, message) {
            socket.instance.getCountModelsNewMessages(chats.settings);

            var owner = profiles.getActive() ?
                getModelProfileFromChannel(channel, profiles.getActive().inner.uid) :
                null;

            if (owner) {
                chats.addNewMessages(channel.identity, getCountNewMessages(channel, owner.uid));
            }

            // tasks.updateTaskChannel(channel);

            if (!chats.isChatActualByFilterOrSettings(channel, false, true)) {
                return;
            }

            removeEmpty(chat.container);

            chat.setChatMessages(channel.identity, [message], true);
            chat.scrollAfterNewMessageReceived();
            input.clearTyping();

            sendNotifyToModel(channel, message);

            if (!chats.getActive() || message.channel.identity !== chats.getActive().identity) {
                return;
            }

            input.checkVirtualGift(
                [MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST, MESSAGE_TYPE_VIRTUAL_GIFT].indexOf(message.type) < 0
            );
            input.checkSticker();
        };

        socket.instance.afterMessageUpdate = function (channel, message) {
            if (!chats.isChatActualByFilterOrSettings(channel, false, true)) {
                return;
            }

            chat.updateChatMessage(channel.identity, message);
        };

        socket.instance.afterChannelUpdate = function (chat) {
            if (!chats.isChatActualByFilterOrSettings(chat, false, true)) {
                return;
            }

            chats.addOrUpdateNewChat(chat);
        };

        socket.instance.joinNewChannel = function (chat) {
            if (!chats.isChatActualByFilterOrSettings(chat)) {
                return;
            }

            chats.addOrUpdateNewChat(chat);
        };

        socket.instance.afterChannelListGet = function (data) {
            if (!data || Object.keys(data).length <= 0)
                return;

            Object.keys(data).forEach(function (key) {
                chats.addOrUpdateNewChat(data[key]);
            });
        };

        socket.instance.afterMemberUpdate = function (identity, member) {
            chats.updateMember(identity, member);
        };

        socket.instance.afterUserOnlineReceived = function (uids) {
            if (uids && Object.keys(uids).length > 0) {
                chats.toggleOnlineStatusInStorage(uids, true);
                Object.keys(uids).forEach(function (key) {
                    chats.toggleOnline(uids[key], true);
                    chat.toggleOnline(uids[key], true);
                });
            }
        };

        socket.instance.afterUserBecomeOnline = function (uid) {
            if (uid) {
                chats.toggleOnlineStatusInStorage(uid, true);
                chats.toggleOnline(uid, true);
                chat.toggleOnline(uid, true);
            }
        };

        socket.instance.afterUserBecomeOffline = function (uid) {
            if (uid) {
                chats.toggleOnlineStatusInStorage(uid);
                chats.toggleOnline(uid);
                chat.toggleOnline(uid);
            }
        };

        socket.instance.typingStart = function (identity, memberUid) {
            input.typingStart(identity, memberUid);
        };

        socket.instance.typingEnd = function (identity, memberUid) {
            input.typingEnd(identity, memberUid);
        };

        socket.instance.afterMessageDelete = function (identity, sid, message) {
            input.deleteMessageFromStore(identity, sid, null, message);
        };

        socket.instance.afterReceivedNewMedia = function (identity, files) {
            media.receivedMediaFiles(identity, files, null, true);
        };

        socket.instance.afterChannelBaned = function (data) {
            chats.modelBanned(data);
        };

        socket.instance.afterStickerAvailable = function (data) {
            input.toggleStickerStatus(data.identity, true);
        };

        socket.instance.afterReceivedCountOfNewTask = function (data) {
            if (typeof data.count === 'undefined') {
                return;
            }

            profiles.updateCatchUpCount(data.count);
        };

        socket.instance.afterTaskFinished = function (data) {
            if (!data.identity) {
                return;
            }

            tasks.removeTask(data.identity);
        };

        socket.instance.afterReceivedNewTask = function (data) {
            tasks.addNewTask(data);
        };

        socket.instance.afterReceivedUpdatedTasks = function (data) {
            if (!data.tasks || !data.tasks.length) {
                return;
            }

            tasks.updateTasks(data.tasks, !!data.playSound);
        };

        socket.instance.afterReceiveFavouritesCount = function (message) {
            chats.updateFavouritesCount(message);
        };
    };

    /**
     * Close connection manual
     */
    socket.closeConnection = function () {
        if (socket.isConnected && socket.isAuthorized) {
            socket.instance.closeConnection();
        }
    };

    socket.initSocket();
    checkBrowserWithWebpCompatible();

    /**
     * Update notiifcators of count new messages
     *
     * @param countChats
     */
    function addCountNew(countChats) {
        if (countChats <= 0) {
            profiles.notifyWrap.text(countChats);
            profiles.notifyWrap.addClass('hidden');
        } else {
            profiles.notifyWrap.text(countChats);
            profiles.notifyWrap.removeClass('hidden');
        }

        var wrap = $('#sidebar-menu .counter-new-mail .label');

        if (!wrap || wrap.length <= 0)
            return;

        var count = wrap.text();

        if (count && parseInt(count) > 0) {
            count = parseInt(count) + parseInt(countChats);

            if (count > 0) {
                $('#sidebar-menu .communication-total').text(count);
                $('#sidebar-menu .communication-total').removeClass('hidden');
            } else {
                $('#sidebar-menu .communication-total').text('');
                $('#sidebar-menu .communication-total').addClass('hidden');
            }
        }
    }

    /**
     * Init dom event listeners
     */
    function initEvent() {
        document.addEventListener('scroll', function (event) {
            if (event.target.id && '#' + event.target.id === templates.chatsContainer) {
                if (tasks.active) {
                    tasks.getTasksList(event, true);
                } else {
                    chats.getMoreChats(event);
                }
            }

            if (event.target.id && '#' + event.target.id === template.chatContainer) {
                chat.getMoreMessages(event);
                chat.consumeAfterStopScroll(event);
            }

            if (event.target.id && event.target.id === 'media-container') {
                media.getMoreMediaFiles(event);
            }

        }, true);

        document.addEventListener('agoraUnsubscribe', function (event) {
            info.resizeWrap();
        });
        document.addEventListener('agoraSubscribe', function (event) {
            info.resizeWrap();
            document.dispatchEvent(new CustomEvent('resizeWithSream', {}));
        });
        document.addEventListener('stremaJoinUser', function (event) {
            if (!event.detail.importUid || !event.detail.userUid) {
                return;
            }

            if (!profiles.getActive() || profiles.getActive().inner.uid !== event.detail.importUid) {
                return;
            }

            var channel = $(templates.chatsContainer).find('.chats[data-member-uid="' + event.detail.userUid + '"]');

            if (channel.length > 0) {
                var identity = channel.attr('data-identity');
                channel.addClass('user-join-stream');

                if (typeof chats.list[identity] !== 'undefined') {
                    chats.list[identity].lastActivity = (new Date()).getTime();
                    chats.moveChat('.chats[data-identity="' + identity + '"]', '.chats', 0);
                }
                setTimeout(function () {
                    if (profiles.getActive() || profiles.getActive().inner.uid == event.detail.importUid) {
                        $(templates.chatsContainer).find('.chats[data-member-uid="' + event.detail.userUid + '"]').removeClass('user-join-stream');
                    }
                }, 3000);
            }
        });

        document.addEventListener('updateSubscribedUsers', function (event) {
            if (!event.detail.importUid) {
                return;
            }

            if (!profiles.getActive() || profiles.getActive().inner.uid !== event.detail.importUid) {
                return;
            }

            var channelViews = $(templates.chatsContainer).find('.chats');
            var usersUid = (!event.detail.usersUid) ? [] : event.detail.usersUid;

            channelViews.each(function () {
                var channel = $(this);

                if (!channel.attr('data-member-uid')) {
                    return;
                }

                if (usersUid.indexOf(parseInt(channel.attr('data-member-uid'))) < 0) {
                    channel.find('.chat-stream-eye').removeClass('active');
                } else {
                    channel.find('.chat-stream-eye').addClass('active');
                }
            });
        });
        document.addEventListener('agoraGetSubscribeUsers', function (event) {
            if (!event.detail || !event.detail.importUid) return;

            if (!isUndefined(chats.data[event.detail.importUid])) {
                var users = [];
                Object.keys(chats.data[event.detail.importUid]).forEach(function (identity) {
                    users.push(chats.data[event.detail.importUid][identity].memberProfile.uid);
                })

                emmitToStreamGetUserActiveSubscribe(users, event.detail.importUid);
            }
        });
        document.addEventListener('updateSoubscribersCounter', function (event) {
            if (!event.detail || !event.detail.importUid) return;

            updateStreameSubscribersCount(event.detail);
        });
        document.addEventListener('updatePorfilesTahtStream', function (event) {
            if (!event.detail || !event.detail) return;

            profiles.sortStreamProfiles(event.detail);
        });
        document.addEventListener('sendGiftMessage', function (event) {
            if (!event.detail || !event.detail) return;

            input.sendGiftMessage(event.detail);
        });
        document.addEventListener('sendStickerMessage', function (event) {
            if (!event.detail || !event.detail) return;

            input.sendStickerMessage(event.detail);
        });

        $('body')
            .on('change', '#onlyFavoriteFilter', function () {
                chats.addFilter();
            })
            .on('click', '#select-media-button li', function () {
                $('#select-media-button').removeClass('open');
            })
            .on('change', template.inputFileFieldId, function (event) {
                input.fileChangedHandler(event);
            })
            .on('change', template.inputDisappearedFileFieldId, function (event) {
                input.fileDisappearedChangedHandler(event);
            })
            .on('submit', template.commentsNewForm, function (event) {
                comments.addNewComment(event);
            })
            .on('keypress', template.commentsNewForm + ' textarea', function () {
                $(this).parent().removeClass('has-error');
            })
            .on('click', templates.commentsContainer + ' .load-more-message', function () {
                comments.getActiveUserComments(true);
            })
            .on('click', templates.profileMediaContainer + ' .load-more-profile-media', function () {
                profileMedia.getActiveUserMedia(true);
            })
            .on('click', '.toggle-wrap-height', function () {
                toggleWrap($(this));
            })
            .on('click', '.chat__details-v2-wrap .details_tabs a', function (event) {
                event.preventDefault();
                toggleDetailsTab($(this));
            })
            .on('click', '#chat_title-opponent .details_tabs a', function (event) {
                event.preventDefault();
                toggleMobileDetailsTab($(this));
                document.dispatchEvent(new CustomEvent('resizeWithSream', {}));
            })
            .on('click', '#menu_toggle', function () {
                setTimeout(function () {input.resizeChatWrap();}, 200);
            })
            .on('click', '#btn-new-chat', function () {
                if (isResponsive() && $('#chat-page').hasClass('nav-sm')) {
                    $('#chat-page').removeClass('nav-sm').addClass('nav-md');
                }
                newChat.getNewChatProfiles();
            })
            .on('click', '.chat-user-start', function (event) {
                event.preventDefault();
                var element = $(this);
                newChat.startChatWith({
                    id: element.attr('data-id'),
                    username: element.attr('data-username'),
                    thumbnail: element.attr('data-thumbnail'),
                    gender: element.attr('data-gender')
                }, element.attr('data-project-id'));
            })
            .on('click', '#' + newChat.container.attr('id') + ' .collapse-link', function (event) {
                event.preventDefault();
                var element = $(this),
                    chevron = element.find('.fa'),
                    xPanel = element.parents('.x_panel').eq(0),
                    xContent = xPanel.find('.x_content');

                if (chevron.hasClass('fa-chevron-down')) {
                    chevron.removeClass('fa-chevron-down').addClass('fa-chevron-up');
                    xContent.show();
                } else {
                    chevron.removeClass('fa-chevron-up').addClass('fa-chevron-down');
                    xContent.hide();
                }
            })
            .on('click', '#' + newChat.selectProfileContainer.attr('id') + ' .close', function (event) {
                setTimeout(function () {
                    newChat.container.modal('show');
                }, 200);
            })
            .on('submit', '#clients-filter-form', function (event) {
                event.preventDefault();
            })
            .on('click', '.more-one-subscribers', function (event) {
                event.preventDefault();
                getActiveStreameSubscribers();
            })
            .on('click', '#load-more-subscribers', function (event) {
                event.preventDefault();
                getActiveStreameSubscribers(true, $(this).attr('data-token'));
            })
            .on('click', '.stream-user-start-chat', function (event) {
                event.preventDefault();
                var element = $(this);
                startChatWithStreamSubscriber({
                    id: element.attr('data-id'),
                    username: element.attr('data-username'),
                    thumbnail: element.attr('data-thumbnail'),
                    gender: element.attr('data-gender')
                }, element.attr('data-project-id'));
            })
            .on('change', '#task-skip-form-reason', function () {
                var value = $(this).val();
                if (value !== '') {
                    $(this).attr('style', '');
                }

                var form = $(this).parents('form').eq(0);

                if (parseInt(value) === SKIP_TASK_REASON_OTHER) {
                    form.find('.task-skip-form-other').removeClass('hidden');
                } else {
                    form.find('.task-skip-form-other').addClass('hidden');
                    form.find('.task-skip-form-other textarea').val('');
                }
            })
            .on('submit', '#task-skip-form', function (event) {
                event.preventDefault();
                var data = $(this).serializeArray();

                $(this).find('.has-error').removeClass('has-error');
                $(this).find('.text-danger').remove();

                if (!tasks.validateSkipFormData($(this), data)) {
                    return;
                }

                tasks.sendSkipTaskForm(data);
            })
            .on('click', '.chats-task', function (event) {
                event.preventDefault();
                var element = $(event.target);

                if (element.hasClass('profiles_task-skip')) {
                    return;
                }
                var identity = $(this).data('identity');

                if (!identity) {
                    return;
                }

                tasks.selectTask(identity);
            })
            .on('click', '.profiles_task-skip', function (event) {
                event.preventDefault();
                var sid = $(this).data('sid');

                if (!sid) {
                    return;
                }

                tasks.skipTask(sid);
            });

        $('#' +  newChat.container.attr('id')).on('shown.bs.modal', function () {
            if (!$('body').hasClass('modal-open'))
                $('body').addClass('modal-open');
        });
        $('#' +  newChat.selectProfileContainer.attr('id')).on('shown.bs.modal', function () {
            if (!$('body').hasClass('modal-open'))
                $('body').addClass('modal-open');
        });
        window.addEventListener("resize", function () {
            if (!isResponsive()) {
                chats.resizeWrap();
                info.resizeWrap();
                chat.resizeWrap();
            }
        });

        window.addEventListener("orientationchange", function (event) {
            if (typeof profiles.initSlider === 'function')
                setTimeout(function () {profiles.initSlider(true, event);}, 300);

            if (!isResponsive()) {
                chats.resizeWrap();
                info.resizeWrap();
                chat.resizeWrap();
            }

            setTimeout(function () {input.resizeChatWrap();}, 200);
        });

        if (!isResponsive()) {
            chats.resizeWrap();
            info.resizeWrap();
            chat.resizeWrap();
        }

        $(template.modalViewVideo).on('hidden.bs.modal', function () {
           $(this).find('.modal-body').html('');
        });

        $(template.modalCommunicationFiles).on('hidden.bs.modal', function () {
           $(this).find('#storage-files').html('<div class="clearfix"></div>');
        });

        $(template.modalCommunicationFiles).on('change', 'input[type="checkbox"]', function () {
            var modal = $(template.modalCommunicationFiles),
                select = modal.find('input[name="selected[]"]:checked');

            if (!select || select.length <= 0)
                modal.find('.attach-button').removeClass('active');
            else
                modal.find('.attach-button').addClass('active');
        });

        $('#search-filter, #onlyFavoriteFilter, .chats-filter label').on('click', function (event) {
            event.stopPropagation();
        });

        $('#excludeWinkSettings, .chats-settings label').on('click', function (event) {
            event.stopPropagation();
        });

        $('.chats-filter input').on('keypress', function () {
            $(this).parent().removeClass('has-error');
            $(this).parent().find('.text-danger').remove();
        });

        setInterval(timeUpdate, 1000 * 60);

        $("#" + input.container.attr('id')).onPositionChanged(function(){
            input.resizeChatWrap();
        });

        disappearedMediaCheckInterval = setInterval(function () {
            updateDisappearedMediaTimer();
        }, 1000);

        $('body').on('click', '#select-media-button .dropdown-toggle', function (event) {
            event.preventDefault();
            if ($(this).parent().hasClass('open') || $(this).find('#select-disappeared-file-button').hasClass('load')) {
                return;
            }

            isAvailableDisappearingMedia();
        });
    }

    function checkBrowserWithWebpCompatible() {
        var cookie = getCookie(COOKIE_IS_WEBP_COMPATIBLE);

        if (cookie) {
            window.isWebpCompatible = cookie;
            return;
        }

        try {
            window.isWebpCompatible = false;

            var img = new Image();
            img.onload = function () {
                if (img.height > 0 && img.width > 0) {
                    window.isWebpCompatible = true;
                    setCookie(COOKIE_IS_WEBP_COMPATIBLE, true, 30);
                }
            };
            img.src = ImgWebp;
        } catch (e) {
            console.log(e.toString());
        }
    }

    profiles.getActive = function () {
        if (tasks.active) {
            if (!tasks.data.activeTask) {
                return null;
            }

            return profiles.data[tasks.data.activeTask.importUid] || null;
        }

        return profiles.active;
    };

    chats.getActive = function () {
        if (tasks.active) {
            if (!tasks.data.activeTask) {
                return null;
            }

            if (tasks.data.activeTask.channel) {
                return tasks.data.activeTask.channel;
            }

            var isUserFirst = tasks.data.activeTask.user.uid > tasks.data.activeTask.profile.uid;

            return {
                identity: tasks.data.activeTask.channelIdentity,
                sid: null,
                members: [
                    isUserFirst ? tasks.data.activeTask.user : tasks.data.activeTask.profile,
                    isUserFirst ? tasks.data.activeTask.profile : tasks.data.activeTask.user,
                ]
            };
        }

        return chats.active;
    };

    chats.resizeWrap = function() {
       var toTop = this.container.offset().top,
           wH = window.innerHeight,
           diff =  wH - toTop;

       if (diff < 550) {
           this.container.css('height', '550px');
           return;
       }
       this.container.css('height', diff + 'px');
    };

    info.resizeWrap = function() {
        var container = $('#info-container'),
            containerComment = $('#comments-container'),
            containerMedia = $('#media-container'),
            toTop = container.offset().top,
            wH = window.innerHeight;

        if (containerComment.hasClass('active'))
            toTop = containerComment.offset().top;

        if (containerMedia.hasClass('active'))
            toTop = containerMedia.offset().top;

        var diff =  wH - toTop;

        // if (diff < 548) {
        //     container.css('height', '548px');
        //     containerComment.css('height', '548px');
        //     containerMedia.css('height', '548px');
        //     return;
        // }

        container.css('height', diff + 'px');
        containerComment.css('height', diff + 'px');
        containerMedia.css('height', diff + 'px');
    };

    chat.resizeWrap = function() {
        var container = $('#chat__message-main-wrap'),
            // paddingTop = parseInt(container.css('padding-top').replace('px', '')),
            // paddingBottom = parseInt(container.css('padding-bottom').replace('px', '')),
            toTop = container.offset().top,
            wH = window.innerHeight,
            // titleH = $('#chat_title-opponent').innerHeight(),
            diff =  wH - toTop;

        // if (!isNaN(paddingTop))
        //     diff += paddingTop;
        //
        // if (!isNaN(paddingBottom))
        //     diff += paddingBottom;

        if (diff < 542) {
            container.css('height', '542px');
            return;
        }

        container.css('height', diff + 'px');
    };

    /**
     * Get new chat profiles
     *
     * @param token
     * @param replace
     */
    newChat.getNewChatProfiles = function (token, replace) {
        newChat.showModal();
        newChat.getModalBody().find('.profiles-responsive-wrap').html('');
        if (!newChat.isInitialized) {
            addPreloader(false, false, newChat.getModalBody());
            newChat.isInitialized = true;
            newChat.getNewChatView();
        } else {
            var windowPosition = newChat.container.scrollTop();
            newChat.getModalBody().find('#load-more').hide();

            if (!replace) {
                addPreloader(true, false, newChat.getModalBody().find('.profiles-responsive-wrap'));
            } else
                addPreloader(false, false, newChat.getModalBody());

            newChat.getNewChatView(true, token, replace, function (data) {
                if (!replace)
                    removePreloader(true, newChat.getModalBody().find('.profiles-responsive-wrap'));
                else
                    removePreloader(false, newChat.getModalBody());

                if (data.success && data.token && parseInt(data.token) > 0) {
                    newChat.getModalBody().find('#load-more').attr('onclick', 'loadMore(' + parseInt(data.token) + ', false)');
                    newChat.getModalBody().find('#load-more').show();
                }

                if (token && !replace)
                    newChat.container.scrollTop(windowPosition);
            });
        }
    };

    /**
     * Get client profiles
     *
     * @param reload
     * @param token
     * @param replace
     * @param cb
     */
    newChat.getNewChatView = function (reload, token, replace, cb) {
        var form =  newChat.getModalBody().find('#clients-filter-form'),
            url = urls.newClientChatGet,
            formData = '';

        if (form.length > 0 && reload)
            formData = form.serialize();

        url += (formData.length > 0) ? '?' + formData.toString() : '';

        if (reload)
            url += (formData.length > 0) ? '&loadMore=true' : '?loadMore=true';

        if (token)
            url += (url.indexOf('?') >= 0) ? '&token=' + token : '?token=' + token;

        $.get(url)
            .done(function(data) {
                if (!reload) {
                    newChat.getModalBody().html(data);
                    newChat.initDataRangePicker();
                } else {
                    if (data.success) {
                        var html = data.html;

                        if (replace) {
                            html = (html.length > 0)
                                ? html
                                : '<div class="alert alert-info">There are no profiles to show.</div>';

                            newChat.getModalBody().find('.profiles-responsive-wrap').html(html);
                        } else
                            newChat.getModalBody().find('.profiles-responsive-wrap').append(html);
                    }
                }

                if (typeof cb === 'function')
                    cb(data);
            })
            .fail(function (error) {
                alertError('Can\'t get profiles for new chat.');
                cb(null, error);
            });
    };

    /**
     * Init data range picker
     */
    newChat.initDataRangePicker = function () {
        var date = new Date(),
            options = {
            "opens": "left",
            "parentEl": $("#clientsfilterform-range-container").parents().eq(1),
            "format":"YYYY-MM-DD",
            "separator":" - ",
            "startDate": Math.floor(date.getTime() / 1000) - (30 * 24 * 60 * 60),
            "endDate": Math.floor(date.getTime() / 1000),
            "ranges":{"Today":[moment(),moment()],"Yesterday":[moment().subtract(1,'days'),moment().subtract(1,'days')],"This week":[moment().weekday(0),moment()],"Last 7 Days":[moment().subtract(6,'days'),moment()],"This Month":[moment().startOf('month'),moment()],"Last Month":[moment().subtract(1, 'months').startOf('month'),moment().subtract(1, 'months').endOf('month')],"Last 30 Days":[moment().subtract(29,'days'),moment()]}};

        $("#clientsfilterform-range-container").daterangepicker(options, function(start, end) {
            var val = start.format('YYYY-MM-DD') + ' - ' + end.format('YYYY-MM-DD');
            $("#clientsfilterform-range-container").find('.range-value').html(val);
            $("#clientsfilterform-range").val(val);
            $("#clientsfilterform-range").trigger('change');
        });
        $("#clientsfilterform-range-container").on('cancel.daterangepicker', function(event, picker) {
            $('#clientsfilterform-range').val("");
            $('.range-value').html("");
        });
    };

    /**
     * Start chat with profile
     *
     * @param user
     * @param projectId
     */
    newChat.startChatWith = function (user, projectId) {
        if (!user || !user.id || !projectId) {
            alertError('Sorry but you can\'t start chat with selected user.');
            return;
        }

        newChat.hideModal();
        newChat.selectProfileContainer.modal('show');
        newChat.showModelProfileList(projectId, user);
    };

    /**
     * Start chat with user or open it if it already exist
     *
     * @param profileUid
     * @param ownerUid
     * @param userUid
     */
    newChat.getChatWith = function (profileUid, ownerUid, userUid) {
        newChat.selectProfileContainer.modal('hide');

        pushToLocationHistory({
            [URL_OWNER_UID_PARAMETER]: ownerUid,
            [URL_PROFILE_UID_PARAMETER]: profileUid,
            [URL_USER_UID_PARAMETER]: userUid
        });

        parseQueryParams();
        profiles.active = null;
        $('.profiles[data-uid="' + ownerUid + '"]').removeClass('active');

        profiles.sortProfileByActivity();
    };

    /**
     * Show modal for select new chat profiles
     *
     * @param projectId
     * @param userData
     */
    newChat.showModelProfileList = function(projectId, userData) {
        var modalContainerBody = newChat.selectProfileContainer.find('.modal-body').find('#profiles-main-wrap');
        modalContainerBody.html('');

        if (isUndefined(projectProfiles[projectId]) || isUndefined(projectProfiles[projectId][userData.gender])) {
            addPreloader(false, false, modalContainerBody);
            profiles.getModelProfilesInProject(projectId, userData, modalContainerBody);
        } else {
            newChat.renderProfiles(projectProfiles[projectId][userData.gender], userData.id);
            removePreloader(true, modalContainerBody);
        }
    };

    /**
     * Render profile containers and set to view
     *
     * @param profiles
     * @param userUid
     * @returns {null}
     */
    newChat.renderProfiles = function (profiles, userUid) {
        var modalContainerBody = newChat.selectProfileContainer.find('.modal-body').find('#profiles-main-wrap');

        if (Object.keys(profiles).length <= 0) {
            addEmpty(modalContainerBody, {text: 'Profile list empty.'});
            return null;
        }

        Object.keys(profiles).forEach(function (key) {
            var profile = profiles[key],
                avatar = profile.avatar ? profile.avatar : {};

            avatar.thumbnail = getProfileThumbnail(profile);
            avatar.src = getProfileThumbnail(profile, 'src');

            modalContainerBody.append(
                getTemplate(
                    templates.newChatProfileTemplate,
                    {
                        profileUid: profile.uid,
                        ownerUid: profile.import_uid,
                        userUid: userUid,
                        avatar: avatar,
                        username:  _.escape(profile.username)
                    }
                )
            );
        });
    };
    /**
     * Show new chat modal
     */
    newChat.showModal = function () {
        if (this.modal === null)
            this.createModal();

        this.modal.modal('show');
    };

    /**
     * Hide chat modal
     */
    newChat.hideModal = function () {
        if (this.modal !== null)
            this.modal.modal('hide');
    };

    /**
     * Create new chat modal
     */
    newChat.createModal = function () {
        this.modal = this.container.modal({keyboard: false});
    };

    /**
     * Get modal body element
     *
     * @returns {*}
     */
    newChat.getModalBody = function () {
        if (this.modal === null)
            this.createModal();

        return this.container.find('.modal-body');
    };

    initEvent();

    /**
     * Profiles data upload
     */
    profiles.removePreloader = removePreloader;
    chats.removePreloader = removePreloader;
    chat.removePreloader = removePreloader;
    info.removePreloader = removePreloader;
    comments.removePreloader = removePreloader;
    media.removePreloader = removePreloader;
    input.removePreloader = removePreloader;
    profiles.addPreloader = addPreloader;
    chats.addPreloader = addPreloader;
    chat.addPreloader = addPreloader;
    info.addPreloader = addPreloader;
    comments.addPreloader = addPreloader;
    media.addPreloader = addPreloader;
    profileMedia.addPreloader = addPreloader;
    profileMedia.removePreloader = removePreloader;
    profiles.addNewMessages = addNewMessages;
    chats.addNewMessages = addNewChatMessages;
    error.addErrorAlert = addErrorAlert;
    profiles.moveProfile = moveObject;
    chats.moveChat = moveObject;
    chats.toggleOnline = toggleOnline;
    chat.toggleOnline = toggleOnline;
    chats.toggleFavorite = toggleFavorite;
    chats.addError = addError;
    chat.addError = addError;
    profiles.addError = addError;
    info.addError = addError;
    comments.addError = addError;
    media.addError = addError;

    /**
     * Add or update aready existed chat
     * @param chat
     */
    chats.addOrUpdateNewChat = function (chat) {
        var importUid = chats.getImportUidFromChat(chat);

        if (!importUid) {
            return;
        }

        var isNew = (!chats.list || isUndefined(chats.list[chat.identity]));

        chats.setChatData(chat, importUid);

        if (!isNew) {
            chats.updateChat(chat);
        } else if (profiles.getActive() && profiles.getActive().inner && profiles.getActive().inner.uid == importUid) {
            chats.addChat(chat, null, true);
        }

        if (isNew) {
            var profile = chats.data[importUid][chat.identity].memberProfile;

            if (profile) {
                socket.instance.isUserOnline(profile.uid);
            }
        }
    };

    /**
     * Update favourites count
     * @param message
     */
    chats.updateFavouritesCount = function (message) {
        var ownerUid = profiles.getActive().inner.uid;
        if (isUndefined(message[ownerUid])) {
            return;
        }

        if (!chats.counters[ownerUid]) {
            chats.counters[ownerUid] = {};
        }

        chats.counters[ownerUid].favouritesCount = message[ownerUid] || 0;
    };

    /**
     * Set model profile banned for channel
     *
     * @param data
     */
    chats.modelBanned = function (data) {
        if (isUndefined(this.data[data.importUid]) || isUndefined(this.data[data.importUid][data.identity]))
            return;

        if (!this.data[data.importUid][data.identity].modelProfile || this.data[data.importUid][data.identity].modelProfile.uid != data.uid)
            return;

        this.data[data.importUid][data.identity].modelProfile.status = CHANNEL_STATUS_BANNED;

        if (this.active && this.active.identity == data.identity)
            chat.setTitle();
    };
    /**
     * Add profiles to disconnected list for update it chats after reconnect
     */
    profiles.setDisconnectedProfiles = function() {
        if (this.data && Object.keys(this.data).length > 0) {
            Object.keys(this.data).forEach(function (id) {
                if (!isUndefined(chats.data[id]))
                    profiles.disconnectedProfiles.push(parseInt(id));
            });
        }
    };

    /**
     * Add chats to disconnected list for update after reconnect
     */
    chat.setDisconnectedChats= function() {
        if (this.data && Object.keys(this.data).length > 0) {
            Object.keys(this.data).forEach(function (identity) {
                chat.disconnectedChats.push(identity);
            })
        }
    };

    /**
     * Delete profile from disconnected list
     * @param profileUid
     */
    profiles.removeDisconnectedProfiles = function(profileUid) {
        if (profiles.disconnectedProfiles.length > 0) {
            var key = profiles.disconnectedProfiles.indexOf(parseInt(profileUid));

            if (key >= 0)
                profiles.disconnectedProfiles.splice(key, 1);
        }
    };

    /**
     * Delete chat from disconnected list
     *
     * @param identity
     */
    chat.removeDisconnectedChats = function (identity) {
        if (chat.disconnectedChats.length > 0) {
            var key = chat.disconnectedChats.indexOf(identity);

            if (key >= 0) {
                chat.disconnectedChats.splice(key, 1);
            }
        }
    };

    /**
     * Initialise  list of profiles or update list after reconnect
     */
    profiles.initModelProfiles = function () {
        profiles.removePreloader();

        if (isEmpty(profiles.data)) {
            chat.removePreloader();
            chats.removePreloader();
            input.removePreloader();

            addEmpty(profiles.container, {text: 'Profile list empty.'});
            return;
        }

        var innerProfiles = [];

        Object.keys(profiles.data).forEach(function (key) {
            var profile = profiles.data[key];

            if (profiles.container.find('.profiles[data-uid="' + profile.inner.uid + '"]').length <= 0)
                profiles.addEmptyProfile(profile);

            innerProfiles.push(profile.inner.uid);
        });

        socket.instance.getModelsProfiles(innerProfiles, chats.settings, profiles.receiveModelProfiles);
    };

    /**
     * Add empty template to profile list wrap
     * @param profile
     */
    profiles.addEmptyProfile = function (profile) {
        this.container.append(getTemplate(template.profileEmptyContainer, profile.inner));
    };

    /**
     * Remove empty template from list profiles
     */
    profiles.removeEmptyProfiles = function () {
        this.container.find('.profiles.empty').remove();
    };

    /**
     * Received and prepared data of profile activity
     * @param data
     */
    profiles.receiveModelProfiles = function (data) {
        if (data && Object.keys(data).length > 0) {
            Object.keys(data).forEach(function (key) {
                var profile = data[key];

                if (profile.import_uid && !isUndefined(profiles.data[profile.import_uid])) {
                    var lastActivity = (isUndefined(profiles.data[profile.import_uid].lastActivity)) ? 0 : profiles.data[profile.import_uid].lastActivity;

                    profiles.data[profile.import_uid].lastActivity = (lastActivity <= profile.lastActivity) ? profile.lastActivity : lastActivity;
                    profiles.data[profile.import_uid].outer[profile.uid] = profile;
                    profiles.outer[profile.uid] = profile;
                }
            });
        }

        profiles.sortProfileByActivity();
    };

    /**
     * Add to chat just received messages
     * @param identity
     * @param data
     * @param error
     */
    chat.receivedMessages = function (identity, data, error) {
        chat.removePreloader();

        if (error) {
            chat.addError(error);
            return;
        }

        if (!data || Object.keys(data).length <= 0) {
            if (!chat.list[identity] || Object.keys(chat.list[identity]).length <= 0) {
                addEmpty(chat.container, {text: 'There is no messages yet.'});
            }

            if (Object.keys(data).length <= 0 && isUndefined(chat.data[identity])) {
                chat.data[identity] = {
                    messages: {}
                };
            }

            return;
        }

        chat.setChatMessages(identity, data);
    };

    /**
     * Add to storage chat messages
     * @param identity
     * @param messages
     * @param isNew
     * @param templateKey
     * @param tempKeySid
     */
    chat.setChatMessages = function (identity, messages, isNew, templateKey, tempKeySid) {
        if (!messages || !identity || Object.keys(messages).length <= 0) {
            return;
        }

        removeEmpty(chats.container);
        removeEmpty(chat.container);

        var isNewChannel = false;

        if (isNew && isUndefined(chat.list[identity])) {
            isNewChannel = true;
        }

        if (isUndefined(chat.list[identity])) {
            chat.list[identity] = [];
        }

        var chatMessages = chat.list[identity];
        chatMessages = chatMessages.concat(messages);

        var sorted = sortObject(chatMessages, 'created', true);
        var messagesSorted = [];

        if (isUndefined(chat.data[identity])) {
            chat.data[identity] = {
                messages: {}
            };
        }

        var dayFormat = getMessageDayFormat(chatMessages[sorted[0]].created);
        var lastMessage = null;
        var loadMoreToken = null;
        var innerUid = profiles.getActive() ? profiles.getActive().inner.uid : null;
        var member = (!innerUid || isUndefined(chats.data[innerUid]) || isUndefined(chats.data[innerUid][identity])) ?
            null :
            chats.data[innerUid][identity];

        Object.keys(sorted).forEach(function (key) {
            if (templateKey && tempKeySid && templateKey == chatMessages[sorted[key]].sid) {
                delete chat.data[identity].messages[templateKey];
            } else {
                messagesSorted[key] = chatMessages[sorted[key]];

                if (
                    member &&
                    messagesSorted[key].memberStatus[member.modelProfile.uid] &&
                    messagesSorted[key].memberStatus[member.modelProfile.uid].status !== MESSAGE_STATUS_DELETED
                ) {
                    loadMoreToken = (!loadMoreToken || loadMoreToken > messagesSorted[key].index) ?
                        messagesSorted[key].index :
                        loadMoreToken;
                }

                lastMessage = messagesSorted[key];

                chat.addOrUpdateMessage(identity, messagesSorted[key], isNew, templateKey, tempKeySid);

                var currentDay = getMessageDayFormat(messagesSorted[key].created);

                if (currentDay != dayFormat) {
                    chat.addDateLine(dayFormat, messagesSorted[key].sid, true);
                    dayFormat = currentDay;
                }

                chat.data[identity].messages[messagesSorted[key].sid] = {
                    sid: messagesSorted[key].sid,
                    index: messagesSorted[key].index,
                    authorUid: messagesSorted[key].author.uid
                };
            }
        });

        if (dayFormat && lastMessage) {
            chat.addDateLine(dayFormat, lastMessage.sid);
        }

        chat.data[identity].loadMoreToken = loadMoreToken;
        chat.list[identity] = messagesSorted;

        if (isNewChannel) {
            emitStreamProfileChannels([{identity: identity}]);
        }

        input.setStickerMessageAnimation('setChatMessages');
    };

    /**
     * Update message after chat api update message event
     * @param identity
     * @param message
     * @param isNew
     * @param templateKey
     * @param tempKeySid
     */
    chat.updateChatMessage = function (identity, message, isNew, templateKey, tempKeySid) {
        if (!message || !identity) {
            return;
        }

        removeEmpty(chats.container);

        if (isUndefined(chat.list[identity])) {
            chat.setChatMessages(identity, [message], isNew, templateKey, tempKeySid);
            return;
        }

        var existMessage = false;

        Object.keys(chat.list[identity]).forEach(function (messageKey) {
            if (isUndefined( chat.list[identity][messageKey]) ||  chat.list[identity][messageKey].sid != message.sid) {
                return;
            }

            chat.list[identity][messageKey] = message;
            existMessage = true;
        });

        if (!existMessage) {
            chat.setChatMessages(identity, [message], isNew, templateKey, tempKeySid);
            return;
        }

        var sorted = sortObject(chat.list[identity], 'created', true);

        Object.keys(sorted).forEach(function (key) {
            if (chat.list[identity][sorted[key]].sid != message.sid) {
                return;
            }

            chat.addOrUpdateMessage(identity, chat.list[identity][sorted[key]], isNew, templateKey, tempKeySid);

            chat.data[identity].messages[chat.list[identity][sorted[key]].sid] = {
                sid: chat.list[identity][sorted[key]].sid,
                index: chat.list[identity][sorted[key]].index,
                authorUid: chat.list[identity][sorted[key]].author.uid
            };
        });

        if (
            profiles.outer[message.author.uid] &&
            (message.type === MESSAGE_TYPE_WINK || message.type === MESSAGE_TYPE_TEXT)
        ) {
            return;
        }

        if (!profiles.outer[message.author.uid] && !info.data[message.author.uid]) {
            return;
        }

        updateUserActiveDataByUid(
            message.author.uid,
            function (data) {
                if (data.success) {
                    updateFilesSelectByFreeBalance(data.data.balance_free, data.data.purchase_type);
                    info.data[message.author.uid] = data.data;
                    realTimeAttributesUpdate(data.data);
                }
            }
        );

        input.setStickerMessageAnimation('updateChatMessage');
    };

    chat.getMessageTemplate = function (message, messageData, isOwner) {
        var template = (isOwner) ? templates.messageOwnerTemplate : templates.messageOpponentTemplate;

        switch (message.type) {
            case MESSAGE_TYPE_MEDIA:
                if (messageData.message.length <= 0) {
                    template = (isOwner) ?
                        templates.messageMediaOwnerTemplate :
                        templates.messageMediaOpponentTemplate;
                }
                break;
            case MESSAGE_TYPE_DISAPPEARING_VIDEO:
                template = (isOwner) ?
                    templates.messageDisappearedVideoOwnerTemplate :
                    templates.messageDisappearedVideoOpponentTemplate;

                if (isDisappearingMessageExpired(message)) {
                    template = (isOwner) ?
                        templates.messageDisappearedVideoExpiredOwnerTemplate :
                        templates.messageDisappearedVideoExpiredOpponentTemplate;
                }

                break;
            case MESSAGE_TYPE_DISAPPEARING_PHOTO:
                template = (isOwner) ?
                    templates.messageDisappearedPhotoOwnerTemplate :
                    templates.messageDisappearedPhotoOpponentTemplate;

                if (isDisappearingMessageExpired(message)) {
                    template = (isOwner) ?
                        templates.messageDisappearedVideoExpiredOwnerTemplate :
                        templates.messageDisappearedVideoExpiredOpponentTemplate;
                }

                break;
            case MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST:
            case MESSAGE_TYPE_VIRTUAL_GIFT:
                template = (isOwner) ?
                    templates.messageGiftOwnerTemplate :
                    templates.messageGiftOpponentTemplate;
                break;
            case MESSAGE_TYPE_STICKER:
                template = (isOwner) ?
                    templates.messageStickerOwnerTemplate :
                    templates.messageStickerTemplate;
                break;
        }

        return template;
    };

    /**
     * Add or update chat messages
     * @param identity
     * @param message
     * @param isNew
     * @param tempKey
     * @param tempKeySid
     */
    chat.addOrUpdateMessage = function (identity, message, isNew, tempKey, tempKeySid) {
        if (!chats.getActive() || chats.getActive().identity !== identity) {
            return;
        }

        var innerUid = profiles.getActive().inner.uid;
        var member = (isUndefined(chats.data[innerUid]) || isUndefined(chats.data[innerUid][identity])) ?
                null :
                chats.data[innerUid][identity];
        var isOwner = false;

        if (!member) {
            member = { gender: GENDER_MALE };
        } else {
            if (member.memberProfile.uid == message.author.uid) {
                member = member.memberProfile;
            } else {
                member = member.modelProfile;
                isOwner = true;
            }
        }

        var messageData = {
            sid: message.sid,
            identity: identity,
            uid: message.author.uid,
            username: _.escape(member.first_name),
            day: getMessageDayFormat(message.created),
            time: getChatMessageDate(message.created),
            message: getMessageContent(message, isOwner),
            messageMedia: getMediaContent(message, isOwner),
            thumbnail: getProfileThumbnail(member),
            actionTypeClass: (message.type === MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST) ? 'v-gift-request' : '',
            disappearedMessageOpened: isAvailableDeleteDisappearingMedia(message) ? '' : 'disappeared-opened'
        };
        var isVirtualGift = [MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST, MESSAGE_TYPE_VIRTUAL_GIFT].indexOf(message.type) >= 0;

        var existMessage = this.container.find('.messages[data-sid="' + messageData.sid + '"]');
        var templateId = chat.getMessageTemplate(
            message,
            messageData,
            isOwner
        );

        if (existMessage.length > 0) {
            existMessage.find('.profiles_avatar').attr('style', 'background-image: url(\'' + messageData.thumbnail + '\')');
            existMessage.find('.profiles_username_text').text(messageData.username);
            existMessage.find('.profiles_time').text(messageData.time);
            existMessage.find('.chat-full-message').html(messageData.message);

            if ([MESSAGE_TYPE_DISAPPEARING_VIDEO, MESSAGE_TYPE_DISAPPEARING_PHOTO].indexOf(message.type) >= 0) {
                existMessage.find('.media').html(messageData.messageMedia);

                if (messageData.disappearedMessageOpened) {
                    existMessage.find('.message-disappeared-media').addClass(messageData.disappearedMessageOpened);
                }

                if (isDisappearingMessageExpired(message)) {
                    existMessage.replaceWith(getTemplate(templateId, messageData));
                }
            } else {
                existMessage.find('.message_media').html(messageData.messageMedia);
            }

            if (isVirtualGift) {
                if (message.gift.status === GIFT_STATUS_OPENED) {
                    existMessage
                        .find('.chat-gift-status')
                        .addClass('vg-opened');
                } else {
                    existMessage
                        .find('.chat-gift-status')
                        .removeClass('vg-opened');
                }

            }

            if (chats.getActive().identity === identity) {
                chat.titleContainerUpdate();
            }
        } else if (tempKey && tempKeySid && message.sid == tempKeySid) {
            var removeMessage = this.container.find('.messages[data-sid="' + tempKey + '"]'),
                countMessages = this.container.find('.messages');

            if (countMessages && countMessages.length > 0 && this.container.find('.messages').eq(countMessages.length - 1).attr('data-sid') == tempKey) {
                this.container.find('.messages').eq(countMessages.length - 1).replaceWith(getTemplate(templateId, messageData));
            } else {
                removeMessage.remove();
                this.container.append(
                    getTemplate(templateId, messageData)
                );
            }
        } else {
            if (isNew) {
                this.container.append(
                    getTemplate(templateId, messageData)
                );
            } else {
                this.container.prepend(
                    getTemplate(templateId, messageData)
                );
            }
        }

        chat.updateMessageReadStatus(message);
        chat.updateMessageStatus(message);
    };

    /**
     * Add date line
     * @param date
     * @param sid
     */
    chat.addDateLine = function (date, sid, after) {
        var wrap = chat.container.find('.message_date-line[data-day="' + date + '"]');

        if (wrap && wrap.length > 0) {
            wrap.remove();
        }

        var tpl = getTemplate(template.dateLineTemplate, { date: date});

        if (after) {
            chat.container.find('.messages[data-sid="' + sid + '"]').after(tpl);
        } else {
            chat.container.find('.messages[data-sid="' + sid + '"]').before(tpl);
        }
    };

    /**
     * Update message read status
     * @param message
     */
    chat.updateMessageReadStatus = function(message) {
        var activeChat = chats.getActive();

        if (isUndefined(chats.list[activeChat.identity]) || isUndefined(message.author)) {
            return;
        }

        var modelProfile = (
            !isUndefined(chats.data[profiles.getActive().inner.uid]) &&
            !isUndefined(chats.data[profiles.getActive().inner.uid][activeChat.identity])) ?
                chats.data[profiles.getActive().inner.uid][activeChat.identity].modelProfile :
            null;

        if (!modelProfile || modelProfile.uid == message.author.uid) {
            return;
        }

        var messageMemberStatus = message.memberStatus[modelProfile.uid];
        var isReadMessage = messageMemberStatus.status === MESSAGE_STATUS_READ || (
            [MESSAGE_STATUS_EXPIRED, MESSAGE_STATUS_FULLY_EXPIRED].indexOf(messageMemberStatus.status) >= 0 &&
            messageMemberStatus.readAt
        );

        if (isReadMessage) {
            chat.container.find('.messages[data-sid="' + message.sid + '"]').find('.message_consume').addClass('active');
        } else {
            chat.container.find('.messages[data-sid="' + message.sid + '"]').find('.message_consume').removeClass('active');
        }
    };

    /**
     * Set or change message delivered and read status
     * @param message
     * @param error
     */
    chat.updateMessageStatus = function (message, error) {
        var identity = message.channel.identity;
        var activeProfile = profiles.getActive();

        if (!chats.getActive() && chats.getActive().identity !== identity || !activeProfile) {
            return;
        }

        var status = message.status;
        var author = message.author;
        var modelProfile = (
            isUndefined(chats.data[activeProfile.inner.uid]) ||
            isUndefined(chats.data[activeProfile.inner.uid][identity])
        ) ?
            null :
            chats.data[activeProfile.inner.uid][identity].modelProfile;
        var memberProfile = (
            isUndefined(chats.data[activeProfile.inner.uid]) ||
            isUndefined(chats.data[activeProfile.inner.uid][identity])
        ) ?
            null :
            chats.data[activeProfile.inner.uid][identity].memberProfile;

        if (!modelProfile || modelProfile.uid !== author.uid || !memberProfile) {
            return;
        }

        var readStatus = (isUndefined(message.memberStatus[memberProfile.uid])) ?
                MESSAGE_STATUS_UNREAD :
                message.memberStatus[memberProfile.uid].status;
        var deleteStatus = (isUndefined(message.memberStatus[modelProfile.uid])) ?
                null :
                message.memberStatus[modelProfile.uid].status;
        var classStatus = '';

        switch (status) {
            case MESSAGE_DELIVERY_BROKE:
                classStatus = 'broken';
                chat.showMessageActionWrap(message);

                if (error && error.text) {
                    chat.toggleMessageError(message.sid, true, error.text);
                }
                break;
            case MESSAGE_DELIVERY_DELIVERED:
                classStatus = 'delivered';
                chat.showMessageActionWrap(message);
                break;
            default:
                classStatus = 'send';
                break;
        }

        switch (readStatus) {
            case MESSAGE_STATUS_READ:
                classStatus += '-read';
                break;
            default:
                classStatus += '-unread';
                break;
        }

        if (deleteStatus === MESSAGE_STATUS_DELETED) {
            classStatus = 'delivered-deleted';
        }

        if (modelProfile.uid == author.uid) {
            this.container.find('.messages[data-sid="' + message.sid + '"]').attr('class', 'messages message-owner');
        } else {
            this.container.find('.messages[data-sid="' + message.sid + '"]').attr('class', 'messages message-opponent');
        }

        this.container.find('.messages[data-sid="' + message.sid + '"]').addClass(classStatus);
    };

    /**
     * Scroll bottom after received new message
     */
    chat.scrollAfterNewMessageReceived = function () {
        var position = chat.container[0].scrollTop,
            clientHeight = chat.container[0].clientHeight,
            scrollHeight = chat.container[0].scrollHeight;

        if (scrollHeight - (position + clientHeight * 2) <= clientHeight) {
            chat.container.scrollTop(chat.container[0].scrollHeight);
        }
    };

    /**
     * Show action wrap if message broken
     * @param message
     */
    chat.showMessageActionWrap = function (message) {
        var wrap = this.container.find('.messages[data-sid="' + message.sid + '"]'),
            temp = message.temp,
            edited = message.edited;

        wrap.find('.message-action-wrap').find('.resend').addClass('hidden');

        chat.reSendActionStatus(message);

        if (temp) {
            wrap.find('.message-action-wrap').find('.edit').addClass('hidden');
        }

        if (edited) {
            wrap.find('.message-action-wrap').find('.history').removeClass('hidden');
        }

        if (
            (message.type == MESSAGE_TYPE_MEDIA && getMessageBody(message).length <= 0) ||
            [MESSAGE_TYPE_DISAPPEARING_PHOTO, MESSAGE_TYPE_DISAPPEARING_VIDEO].indexOf(message.type) >= 0
        ) {
            wrap.find('.message-action-wrap').find('.delete-media').removeClass('hidden');
        }

        wrap.find('.message-action-wrap').removeClass('hidden');

        if (message.type === MESSAGE_TYPE_WINK && message.status !== MESSAGE_DELIVERY_BROKE) {
            wrap.find('.message-action-wrap').find('.resend').addClass('hidden');
            wrap.find('.message-action-wrap').find('.edit').addClass('hidden');
            wrap.find('.message-action-wrap').find('.delete').addClass('hidden');
        }
    };

    /**
     * Add error to message wrap
     * @param messageId
     * @param show
     * @param text
     */
    chat.toggleMessageError = function (messageId, show, text) {
        var msgWrap = $('.messages[data-sid="' + messageId + '"]');

        if (msgWrap.length === 0) {
            return;
        }

        if (show && text) {
            msgWrap.find('.message-error').text(text);
            msgWrap.find('.message-error').addClass('active');
        } else {
            msgWrap.find('.message-error').text('');
            msgWrap.find('.message-error').removeClass('active');
        }
    };

    /**
     * Set streamed profiles in first position
     * @param profile
     */
    profiles.sortStreamProfiles = function (profile) {
        var importUid = (profile.import_uid) ? profile.import_uid : null;

        if (!importUid || isUndefined(profiles.data[profile.import_uid])) {
            return;
        }
        profiles.data[profile.import_uid].lastActivity = Math.floor((new Date()).getTime() / 1000);

        profiles.sortProfileByActivity(true);
    };

    /**
     * Sort profiles by channel last activity
     *
     * @param renewProfileSlider
     */
    profiles.sortProfileByActivity = function (renewProfileSlider) {
        var sort = sortObject(profiles.data, 'lastActivity', true);
        var position = 1; // set first position for catch up wrap
        var selectProfile = null;

        if (queryParams.ownerUid && sort.indexOf(queryParams.ownerUid) >= 0) {
            sort.splice(sort.indexOf(queryParams.ownerUid), 1);
            sort.unshift(queryParams.ownerUid);
        }

        sort.map(function (key) {
            if (!isUndefined(profiles.data[key])) {
                var innerProfile = profiles.data[key].inner;
                innerProfile.newMessages = profiles.data[key].newMessages;

                profiles.addProfile(innerProfile, position, false);

                if (!profiles.getActive() && position <= 1) {
                    selectProfile = profiles.data[key].inner.uid;
                }

                if (queryParams.ownerUid && queryParams.ownerUid == profiles.data[key].inner.uid) {
                    selectProfile = profiles.data[key].inner.uid;
                }

                if (profiles.getActive() && profiles.getActive().inner.uid == profiles.data[key].inner.uid) {
                    selectProfile = profiles.data[key].inner.uid;
                }

                position++;
            }
        });

        profiles.addCatchUpWrap();

        profiles.initSlider(renewProfileSlider);

        if (!tasks.active) {
            profiles.selectProfile(selectProfile);
        }

        document.dispatchEvent(eventAddProfilesToView);
    };

    /**
     * Get inner profiles id
     *
     * @returns {null|*}
     */
    profiles.getInnerProfilesIds = function () {
        if (isEmpty(profiles.data)) {
            return null;
        }

        var innerProfiles = [];

        Object.keys(profiles.data).forEach(function (key) {
            var profile = profiles.data[key];

            innerProfiles.push(profile.inner.uid);
        });

        return innerProfiles.length <= 0 ? null : innerProfiles;
    };

    /**
     *
     * @param projectId
     * @param userData
     * @param modalContainer
     */
    profiles.getModelProfilesInProject = function (projectId, userData, modalContainer) {
        var innerProfiles = profiles.getInnerProfilesIds();

        if (isEmpty(innerProfiles)) {
            return;
        }

        var genderForSearch = (userData.gender == GENDER_MALE) ? GENDER_FEMALE : GENDER_MALE;

        socket.instance.getModelsProfilesSimple(innerProfiles, {projectId: projectId, gender: genderForSearch}, function (data, error) {
            removePreloader(false, modalContainer);
            if (data && !error) {
                if (isUndefined(projectProfiles[projectId]))
                    projectProfiles[projectId] = {};

                projectProfiles[projectId][userData.gender] = data;
            }

            newChat.renderProfiles(data, userData.id);
        });
    };

    /**
     * Init slick slider
     */
    profiles.initSlider = function (resize) {
        var slickOptions = {
            dots: false,
            infinite: false,
            speed: 100,
            slidesToScroll: 3,
            arrows: false,
            centerMode: false,
            variableWidth: true,
            swipeToSlide: true
        };

        if (profileSliderInitStatus !== SLICK_SLIDER_START_INIT) {
            if (resize && profileSliderInitStatus === SLICK_SLIDER_INITIALIZED) {
                // this.container.slick('slickSetOption', slickOptions);
                // this.container.slick("slickGoTo", 0);
            } else {
                this.container.slick(slickOptions);
                this.container.slick("slickGoTo", 0);
                profileSliderInitStatus = SLICK_SLIDER_START_INIT;
            }
        }

        if (!resize && profileSliderInitStatus === SLICK_SLIDER_START_INIT) {
            $('.chat__profile-v2-wrap .prev-button').on('click', function () {
                profiles.container.slick('slickPrev');
            });

            $('.chat__profile-v2-wrap .next-button').on('click', function () {
                profiles.container.slick('slickNext');
            });

            this.container.on('init', function(event, slick){
                profileSliderInitStatus = SLICK_SLIDER_INITIALIZED;
            });
        }
    };

    profiles.addCatchUpWrap = function () {
        var wrap = profiles.container.find('#profile-catchup');

        if (wrap.length > 0) {
            return;
        }

        profiles.container.prepend(getTemplate(template.profileCatchUp, {}));
        profiles.moveProfile('#profile-catchup', '.profiles', 0);

        profiles.getCountOfNewTasks();
    };

    profiles.getCountOfNewTasks = function () {
        socket.instance.getCountNewTask(function (data, error) {
            if (error) {
                return;
            }

            profiles.updateCatchUpCount(data && data.count ? parseInt(data.count) : 0);
        });
    };

    profiles.updateCatchUpCount = function (count) {
        var wrap = profiles.container.find('#profile-catchup');

        if (!wrap.length) {
            return;
        }

        if (count > 0) {
            wrap.addClass('has-new');
            wrap.find('.profiles_new-messages').addClass('active').text(count);
        } else {
            wrap.removeClass('has-new');
            wrap.find('.profiles_new-messages').removeClass('active').text(count);
        }
    };

    /**
     * Add or update profile list
     * @param profile
     * @param position
     * @param prepend
     */
    profiles.addProfile = function (profile, position, prepend) {
        var profileExist = profiles.container.find('.profiles[data-uid="' + profile.uid + '"]').not('.empty');

        if (profileExist.length <= 0) {
            var tpl = profiles.container.append(getTemplate(template.profileContainer, profile)),
                emptyProfile = profiles.container.find('.profiles.empty').eq(0);

            if (!isUndefined(emptyProfile)) {
                emptyProfile.remove();
            }

            if (prepend) {
                $(tpl).prependTo(profiles.container);
            } else {
                profiles.container.append(tpl);
            }

            if (profile.newMessages && parseInt(profile.newMessages) > 0) {
                profiles.addNewMessages(profile.uid, parseInt(profile.newMessages));
            }
        } else {
            profiles.updateProfileData(profile);
            profiles.moveProfile('.profiles[data-uid="' + profile.uid + '"]', '.profiles', position);
        }
    };

    /**
     * Get model owmner uid from chat
     * @param chat
     * @returns {*}
     */
    chats.getImportUidFromChat = function (chat) {
        if (isUndefined(chat.members) && chat.members.length <= 0)
            return null;

        var importUid = null;

        Object.keys(chat.members).forEach(function(key) {
            var member = chat.members[key];

            if (member && member.import_uid && !isUndefined(profiles.data[member.import_uid]))
                importUid = member.import_uid;
        });

        return importUid;
    };

    /**
     * Add or update already exist chat
     * @param channel
     * @param position
     * @param prepend
     */
    chats.addChat = function (channel, position, prepend) {
        var chatExist = chats.container.find('.chats[data-identity="' + channel.identity + '"]').not('.empty');

        if (chatExist.length <= 0) {
            var listChat = chats.data[profiles.getActive().inner.uid][channel.identity];
            var member = listChat.memberProfile;
            var owner = listChat.modelProfile;
            var tpl = getTemplate(template.chatTemplate, {
                uid: member.uid,
                username: (!member) ? 'Unset' : _.escape(member.first_name),
                identity: channel.identity,
                thumbnail: getProfileThumbnail(member),
                time: getChatTimeFormat(channel.lastActivity),
                message: (!member) ? '' : getChatLastMessage(channel, member.uid)
             });
            var emptyChat = chats.container.find('.chats.empty').eq(0);

            if (!isUndefined(emptyChat)) {
                emptyChat.remove();
            }

            if (prepend) {
                $(tpl).prependTo(chats.container);
            } else {
                chats.container.append(tpl);
            }

            if (listChat.isMemberOnline) {
                chats.toggleOnline(member.uid, true);
                chat.toggleOnline(member.uid, true);
            }

            var chatCounters = chats.counters[profiles.getActive().inner.uid];
            chats.toggleFavorite(
                channel.identity,
                listChat.isFavorite,
                chatCounters ? chatCounters.favouritesCount || 0 : 0
            );
            chats.addNewMessages(channel.identity, getCountNewMessages(channel, owner.uid));
        } else {
            chats.updateChat(channel);
        }
    };

    chats.addTasksChat = function (task, position) {
        var chatExist = chats.container.find('.chats[data-identity="' + task.channelIdentity + '"]').not('.empty');
        var member = task.user;
        var profile = task.profile;
        var channel = task.channel;

        var tpl = getTemplate(template.chatTaskTemplate, {
            sid: task.sid,
            uid: member.uid,
            username: (!member) ? 'Unset' : _.escape(member.username),
            identity: task.channelIdentity,
            thumbnail: getProfileThumbnail(member, null),
            profileThumbnail: getProfileThumbnail(profile, null),
            time: channel ? getChatTimeFormat(channel.lastActivity) : '',
            message: channel ? getChatLastMessage(channel, member.uid) : '',
            disableSkip: (task.priority <= 1 || task.status === TASK_STATUS_DISABLED) && !(task.isActive === false) ?
                '' :
                '<small class="profiles_task-skip" data-sid="' + task.sid + '">Skip</small>',
            isActive: tasks.data.activeTask && tasks.data.activeTask.channelIdentity === task.channelIdentity
        });

        if (channel && profiles.data[profile.import_uid]) {
            chats.setChatData(channel, profile.import_uid);
        }

        var currentPosition = chats.container.find('.chats-task').eq(position);

        if (!chatExist.length) {
            var emptyChat = chats.container.find('.chats.empty').eq(0);

            if (!isUndefined(emptyChat)) {
                emptyChat.remove();
            }

            if (currentPosition.length && currentPosition.data('identity') !== task.channelIdentity) {
                currentPosition.before(tpl);
            } else {
                chats.container.append(tpl);
            }
        } else {
            if (tasks.data.activeTask && tasks.data.activeTask.channelIdentity === task.channelIdentity) {
                chatExist.replaceWith(tpl);
            } else {
                if (currentPosition.length && currentPosition.data('identity') !== task.channelIdentity) {
                    chatExist.remove();
                    currentPosition.before(tpl);
                } else {
                    chatExist.replaceWith(tpl);
                }
            }
        }


        if (tasks.users[member.uid] && tasks.users[member.uid].isOnline) {
            chats.toggleOnline(member.uid, true);
            chat.toggleOnline(member.uid, true);
        }

        if (channel) {
            var chatCounters = chats.counters[profile.import_uid];
            var favouritesCount = chatCounters ? chatCounters.favouritesCount || 0 : 0;
            chats.toggleFavorite(channel.identity, channel.favorite || CHANEL_NOT_FAVORITE, favouritesCount);
            chats.addNewMessages(channel.identity, getCountNewMessages(channel, profile.uid));
        }
    }

    /**
     * Update chat data in a local storage and in a view if it active
     * @param channel
     */
    chats.updateChat = function (channel) {
        var chatExist = chats.container.find('.chats[data-identity="' + channel.identity + '"]').not('.empty');
        var needMove = false;

        if (isUndefined(chats.list[channel.identity]) || chats.list[channel.identity].lastActivity > channel.lastActivity) {
            return;
        }

        if (chats.list[channel.identity].lastActivity != channel.lastActivity) {
            Object.keys(chats.data).forEach(function (key) {
                if (!isUndefined(chats.data[key][channel.identity])) {
                    chats.data[key][channel.identity].lastActivity = (
                        !chats.data[key][channel.identity].lastActivity ||
                        chats.data[key][channel.identity].lastActivity <= channel.lastActivity
                    ) ? channel.lastActivity : chats.data[key][channel.identity].lastActivity;
                }
            });
        }

        chats.list[channel.identity] = channel;

        tasks.updateTaskChannel(channel);

        if (chatExist.length > 0) {
            var chatsWrap = chats.container.find('.chats').not('.empty');
            var chatPosition = chats.getActiveChatPositionByActivity(channel);

            if (chatPosition && chatPosition >= 0) {
                var chatExistPosition = chatsWrap.eq(chatPosition);

                if (chatExistPosition.attr('data-identity') != channel.identity) {
                    needMove = true;
                }
            }

            var member = null;
            var owner = null;

            if (tasks.active) {
                var task = tasks.getTaskByChannelIdentity(channel.identity);

                if (task) {
                    member = task.user;
                    owner = task.profile;
                }
            } else {
                var listChat = chats.data[profiles.getActive().inner.uid][channel.identity];
                member = listChat.memberProfile;
                owner = listChat.modelProfile;
            }

            if (!member || !owner) {
                return;
            }

            var chatData = {
                uid: member.uid,
                username: (!member) ? 'Unset' : _.escape(member.first_name),
                thumbnail: getProfileThumbnail(member),
                time: getChatTimeFormat(channel.lastActivity),
                message: (!member) ? '' : getChatLastMessage(channel, member.uid)
            };

            chatExist.find('.profiles_avatar:not(.owner)').attr('style', 'background-image: url(\'' + chatData.thumbnail + '\')');
            chatExist.find('.chat-short-message').html(chatData.message);
            chatExist.find('.profiles_username_text').text(chatData.username);
            chatExist.find('.profiles_time').text(chatData.time);
            chats.addNewMessages(channel.identity, getCountNewMessages(channel, owner.uid));

            if (needMove) {
                chats.moveChat('.chats[data-identity="' + channel.identity + '"]', '.chats', chatPosition);
            }

            if (chats.getActive() && chats.getActive().identity == channel.identity) {
                chat.titleContainerUpdate();
            }
        }
    };

    /**
     * Get chat position in sort list
     * @param chat
     * @returns {*}
     */
    chats.getActiveChatPositionByActivity = function (chat) {
        if (!profiles.getActive()) {
            return null;
        }

        if (isUndefined(chats.data[profiles.getActive().inner.uid])) {
            return null;
        }

        var chatList = chats.data[profiles.getActive().inner.uid];

        if (isUndefined(chatList[chat.identity])) {
            return null;
        }

        var sort = sortObject(chatList, 'lastActivity', true);

        return sort.indexOf(chat.identity);
    };

    /**
     * Send request for get update of channels and newbie channels
     */
    profiles.getNewbieProfileChannels = function() {
        var data = chats.data;
        var activeProfile = profiles.getActive();

        if (!activeProfile || isUndefined(activeProfile.inner)) {
            return;
        }

        if (isUndefined(data[activeProfile.inner.uid])) {
            return;
        }

        if (Object.keys(data[activeProfile.inner.uid]).length <= 0) {
            return;
        }

        var profileList = data[activeProfile.inner.uid];
        var sorted = sortObject(data[activeProfile.inner.uid], 'lastActivity', true);
        var filters = (!isUndefined(chats.filters[activeProfile.inner.uid])) ?
            chats.filters[activeProfile.inner.uid] :
            null;

        socket.instance.getNewbieChannels(
            activeProfile.inner.uid,
            profileList[sorted[0]].lastActivity,
            filters,
            chats.settings
        );
    };

    /**
     * Try to get newbie and updated messages after disconnect
     * @param ownerUid
     * @param identity
     */
    chat.getNewbieChatMessages = function (ownerUid, identity) {
        if (!ownerUid || !identity || isUndefined(chat.list[identity])) {
            return;
        }

        var sorted = sortObject(chat.list[identity], 'updated', true);
        var lastUpdated = chat.list[identity][sorted[0]].updated;

        if (!lastUpdated) {
            return;
        }

        socket.instance.getChannelMessages(ownerUid, identity, function (data, error, token) {
            if (error) {
                return;
            }

            chat.receivedMessages(identity, data, error, token);
            chat.scrollAfterNewMessageReceived();
        }, true, lastUpdated);
    };

    /**
     * Get updates for channels that was uploaded yearly
     */
    profiles.getUpdatedProfileChannels = function () {
        var data = chats.data;
        var activeProfile = profiles.getActive();

        if (!activeProfile || isUndefined(activeProfile.inner)) {
            return;
        }

        if (isUndefined(data[activeProfile.inner.uid])) {
            getProfileChannels(activeProfile.inner.uid);
        } else {
            var filters = (!isUndefined(chats.filters[activeProfile.inner.uid])) ? chats.filters[activeProfile.inner.uid] : null;
            socket.instance.getChannelUpdates(Object.keys(data[activeProfile.inner.uid]), activeProfile.inner.uid, filters, chats.settings);
        }
    };

    /**
     * Update member data in all already uploded chats
     * @param identity
     * @param member
     */
    chats.updateMember = function (identity, member) {
        if (!member.uid || !chats.list || Object.keys(chats.list).length <= 0) {
            return;
        }

        var chatsForUpdate = [];

        Object.keys(chats.list).forEach(function (identity) {
            var members = chats.list[identity].members;

            if (members && members.length > 0) {
                Object.keys(members).forEach(function (key) {
                    if (members[key].uid == member.uid) {
                        chats.list[identity].members[key] = member;
                        chatsForUpdate.push(chats.list[identity]);
                    }
                });
            }
        });

        if (chatsForUpdate.length > 0) {
            Object.keys(chatsForUpdate).forEach(function (key) {
                Object.keys(chats.data).forEach(function (ownerUid) {
                    if (!isUndefined(chats.data[ownerUid][chatsForUpdate[key].identity])) {
                       chats.data[ownerUid][chatsForUpdate[key].identity].memberProfile = member;
                    }
                });

                chats.updateChat(chatsForUpdate[key]);
            });
        }
    };

    /**
     * Update selected profile data
     * @param profile
     */
    profiles.updateProfileData = function (profile) {
        var profileWrap = profiles.container.find('.profiles[data-uid="' + profile.uid + '"]');

        if (profileWrap.length <= 0) {
            return;
        }

        var avatar = profileWrap.find('.profiles_avatar');
        var username = profileWrap.find('.profiles_username_text');

        avatar.attr('style', 'background-image: url(\'' + getPhotoUrl(profile.avatar.thumbnail) + '\')');
        avatar.attr('data-src', getPhotoUrl(profile.avatar.src));

        username.text(profile.username);

        profiles.addNewMessages(profile.uid, profile.newMessages);
    };

    profiles.openCatchUp = function (fromView) {
        var catchUp = profiles.container.find('#profile-catchup');

        if (catchUp.hasClass('active')) {
            return;
        }

        if (fromView) {
            queryParams = {};
        }

        profiles.container.find('.profiles.active').removeClass('active');
        catchUp.addClass('active');

        profiles.removePreloader();

        removeEmpty(chats.container);

        profiles.active = null;
        chats.active = null;
        chat.container.html('');

        input.disableInput();
        input.clearTyping();
        input.clearTextFieldError();
        chat.clearTitle();
        info.clear();
        comments.clear();
        profileMedia.clear();
        chats.hideFilterView();
        chats.updateSettings();
        chats.container.html('');

        pushToLocationHistory({});
        tasks.resetTasksData(true);

        tasks.getTasksList();
        emitStreamSelectProfile(null);
    };

    /**
     * Select model profile and send data
     * @param uid
     * @param fromView
     */
    profiles.selectProfile = function (uid, fromView) {
        tasks.resetTasksData();

        var element = $('.profiles[data-uid="' + uid + '"]');

        if (element.hasClass('active')) {
            return;
        }

        if (fromView) {
            queryParams = {};
        }

        // scrollToView(element);

        profiles.removePreloader();

        removeEmpty(chats.container);

        profiles.container.find('.profiles.active').removeClass('active');

        element.addClass('active');

        profiles.active = profiles.data[uid];

        chats.active = null;
        chat.container.html('');

        input.disableInput();
        input.clearTyping();
        input.clearTextFieldError();
        chat.clearTitle();
        info.clear();
        comments.clear();
        profileMedia.clear();
        chats.setFilter();
        chats.updateSettings();
        chats.container.html('');

        profiles.setProfileToHistory(
            (profiles.getActive().inner && profiles.getActive().inner.uid) ?
                profiles.getActive().inner.uid :
                null
        );

        if (profiles.loaded.indexOf(uid) >= 0) {
            chats.container.html('');
            chats.addPreloader();
            setTimeout(function () {
                chats.setChats();
                chats.removePreloader();
            }, 100);

            if (profiles.disconnectedProfiles.indexOf(uid) >= 0) {
                profiles.removeDisconnectedProfiles(uid);
                profiles.getNewbieProfileChannels();
                profiles.getUpdatedProfileChannels();
            }
        } else {
            chats.addPreloader();
            getProfileChannels(uid);
        }

        emitStreamSelectProfile(profiles.getActive().inner.uid);
    };

    /**
     * Emmit custom event about select profile to stream api
     * @param uid
     */
    function emitStreamSelectProfile(uid) {
        document.dispatchEvent(new CustomEvent('streamSelectChatProfile', {detail: {uid: uid}}));
    }
    /**
     * Set owner uid to history
     *
     * @param ownerUid
     */
    profiles.setProfileToHistory = function (ownerUid) {
        var data = {};
        if (ownerUid) {
            data[URL_OWNER_UID_PARAMETER] = ownerUid;
        }

        data[URL_USER_UID_PARAMETER] = '';
        data[URL_PROFILE_UID_PARAMETER] = '';

        pushToLocationHistory(data);
    };

    /**
     * Get model profile access token
     * @param uid
     * @param identity
     * @returns {null|*}
     */
    profiles.getModelToken = function (uid, identity) {
        if (isUndefined(uid) || isUndefined(identity))
            return null;

        if (isUndefined(chats.data[uid]) || isUndefined(chats.data[uid][identity]))
            return null;

        var profile = chats.data[uid][identity].modelProfile;

        if (!profile || isUndefined(profiles.outer[profile.uid]))
            return null;

        return  profiles.outer[profile.uid].access_token;
    };

    /**
     * Get model api token
     *
     * @param projectId
     * @returns {null|*}
     */
    function getApiToken(projectId) {
        return apiToken;
    }

    /**
     * Get list of chats for selected profile
     * @param profileUid
     */
    function getProfileChannels(profileUid) {
        var filters = {};

        if (!isUndefined(chats.filters[profileUid])) {
            filters = chats.filters[profileUid];
        }

        socket.instance.getChannelList(profileUid, filters, chats.settings, function (data, error, token) {
            profiles.loaded.push(profileUid);
            profiles.data[profileUid].loadMoreToken = token;
            profiles.data[profileUid].sendMoreRequest = false;

            receiveChatsList(data, profileUid);
        });
    }

    /**
     * Receive list of chats and save it local
     * @param data
     * @param ownerUid
     */
    function receiveChatsList(data, ownerUid) {
        if (
            Object.keys(data).length <= 0 && queryParams.ownerUid &&
            profiles.getActive().inner.uid == queryParams.ownerUid
        ) {
            var preselectResult = chats.getChatOrCreateNewFromQuery(queryParams, updateSubscribedChannelsAfterGetNew);

            if (preselectResult !== false) {
                return;
            }
        }

        if (Object.keys(data).length <= 0 && profiles.getActive().inner.uid == ownerUid) {
            addEmpty(chats.container, {text: 'Chat list is empty.'});
            input.removePreloader();
            return;
        }

        if (isUndefined(chats.data[ownerUid])) {
            chats.data[ownerUid] = {};
        }

        Object.keys(data).forEach(function (key) {
            chats.setChatData(data[key], ownerUid);
        });

        if (profiles.getActive().inner.uid != ownerUid) {
            return;
        }

        chats.removePreloader();
        chats.container.html('');
        chats.setChats();
        input.toggleFilesInputDisable();
        input.toggleFilesInputDisableOnBalanceFree();

        emitStreamProfileChannels(data);
    }

    chats.getPositionToBottomAfterScroll = function (event) {
        var position = event.target.scrollTop;
        var toTop = position + event.target.clientHeight;
        return event.target.scrollHeight - toTop;
    };

    /**
     * Load more model profile chats and add in on a page
     * @param event
     */
    chats.getMoreChats = function (event) {
        var activeProfile = profiles.getActive();

        if (!activeProfile) {
            return;
        }

        var profileData = (profiles.data[activeProfile.inner.uid]);

        if (
            !profileData ||
            isUndefined(profileData.loadMoreToken) ||
            isUndefined(chats.data[activeProfile.inner.uid])
        ) {
            return;
        }

        if (profileData.loadMoreToken === null) {
            return;
        }

        if (isUndefined(profileData.sendMoreRequest) || profileData.sendMoreRequest === true) {
            return;
        }

        var position = event.target.scrollTop;

        if (chats.getPositionToBottomAfterScroll(event) > 10) {
            return;
        }

        chats.addPreloader(true);
        profiles.data[activeProfile.inner.uid].sendMoreRequest = true;

        var filters = {};

        if (!isUndefined(chats.filters[activeProfile.inner.uid])) {
            filters = chats.filters[activeProfile.inner.uid];
        }

        socket.instance.getMoreChannels(function (data, error, token) {
            if (data && Object.keys(data).length > 0) {
                Object.keys(data).forEach(function (key) {
                    var chat = data[key],
                        countChats = (!isUndefined(chats.data[activeProfile.inner.uid])) ? Object.keys(chats.data[activeProfile.inner.uid]).length : 0,
                        isNew = (!chats.list || isUndefined(chats.list[chat.identity]));

                    chats.setChatData(chat, activeProfile.inner.uid);

                    if (!isNew) {
                        chats.updateChat(chat);
                    } else if (
                        profiles.getActive() &&
                        profiles.getActive().inner &&
                        profiles.getActive().inner.uid == activeProfile.inner.uid
                    ) {
                        chats.addChat(chat, countChats + 1);
                    }
                });
            }

            $(templates.chatsContainer).scrollTop(position);

            chats.removePreloader(true);
            profiles.data[activeProfile.inner.uid].loadMoreToken = token;
            profiles.data[activeProfile.inner.uid].sendMoreRequest = false;
        }, profileData.loadMoreToken, activeProfile.inner.uid, filters, chats.settings);
    };

    /**
     * Try to get more messages
     * @param event
     */
    chat.getMoreMessages = function(event) {
        var activeProfile = profiles.getActive();
        var activeChat = chats.getActive();

        if (!activeProfile || !activeChat) {
            return;
        }

        var position = event.target.scrollTop;
        var scrollHeight = event.target.scrollHeight;

        if (position > 10) {
            return;
        }

        var loadMoreToken = 0;
        var sendMoreRequest = 0;

        if (!isUndefined(chat.data[activeChat.identity])) {
            loadMoreToken = (isUndefined(chat.data[activeChat.identity].loadMoreToken)) ?
                0 :
                chat.data[activeChat.identity].loadMoreToken;
            sendMoreRequest = (isUndefined(chat.data[activeChat.identity].sendMoreRequest)) ?
                false :
                chat.data[activeChat.identity].sendMoreRequest;
        }

        if (!loadMoreToken || loadMoreToken <= 1 || !!sendMoreRequest) {
            return;
        }

        chat.addPreloader(true, true);
        chat.data[activeChat.identity].sendMoreRequest = true;

        socket.instance.getMoreMessages(activeProfile.inner.uid, activeChat.identity, loadMoreToken, function (data, error) {
            chat.removePreloader(true);

            if (error || !data || Object.keys(data).length <= 0) {
                chat.data[activeChat.identity].sendMoreRequest = false;
                chat.data[activeChat.identity].loadMoreToken = 0;
                return;
            }

            chat.receivedMessages(activeChat.identity, data);
            chat.container.scrollTop(chat.container[0].scrollHeight - (scrollHeight + 100));
            chat.data[activeChat.identity].sendMoreRequest = false;
        });
    };

    /**
     * Consume messages in a chat
     */
    chat.consumeMessages = function () {
        var active = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!active || !activeProfile) {
            return;
        }

        var position = chat.container[0].scrollTop + chat.container[0].clientHeight;

        var channel = (isUndefined(chats.data[activeProfile.inner.uid]) || isUndefined(chats.data[activeProfile.inner.uid][active.identity]))
            ? null
            : chats.data[activeProfile.inner.uid][active.identity];

        if (!channel) {
            return;
        }

        var lastConsume = (isUndefined(channel.lastConsumeMessage)) ? 0 : channel.lastConsumeMessage;
        var chatIndex = (isUndefined(chats.list[active.identity])) ? 0 : chats.list[active.identity].index;

        if (lastConsume >= chatIndex) {
            return;
        }

        var messages = this.container.find('.messages');

        if (!messages || messages.length <= 0) {
            return;
        }

        for (var i = messages.length - 1; i >= 0; i--) {
            var message = messages.eq(i);
            var sid = message.attr('data-sid');
            var messagePosition = message[0].offsetTop + (message[0].clientHeight / 2);

            if (
                isUndefined(chat.data[active.identity].messages) ||
                isUndefined(chat.data[active.identity].messages[sid])
            ) {
                continue;
            }

            var messageInst = chat.data[active.identity].messages[sid];
            var temp = (
                !isUndefined(chat.data[active.identity].messages[sid].temp) &&
                chat.data[active.identity].messages[sid].temp
            );


            if (active.index <= lastConsume || temp || channel.modelProfile.uid == messageInst.authorUid) {
                continue;
            }

            if (position >= messagePosition) {
                chats.data[activeProfile.inner.uid][active.identity].lastConsumeMessage = active.index;
                chats.list[active.identity].index = active.index;

                setTimeout(function () {
                    socket.instance.consumeMessage(
                        activeProfile.inner.uid,
                        active.identity,
                        active.index,
                        chats.settings
                    );
                }, 2000);

                return;
            }
        }
    };

    /**
     * Consume message after stop scrolling message wrap
     * @param event
     */
    chat.consumeAfterStopScroll = function (event) {
        clearTimeout($.data(this, 'scrollMessageTimer'));
        $.data(this, 'scrollMessageTimer', setTimeout(function () {
            chat.consumeMessages(true);
        }, 250));
    };

    /**
     * Update message status after delivery error
     * @param channel
     * @param message
     * @param error
     */
    chat.messageDeliveryError = function (channel, message, error) {
        if (isUndefined(chat.list[channel.identity]) || Object.keys(chat.list[channel.identity]).length <= 0)
            return;

        Object.keys(chat.list[channel.identity]).forEach(function (key) {
           if (message.key == chat.list[channel.identity][key].sid) {
               chat.list[channel.identity][key].status = MESSAGE_DELIVERY_BROKE;
               chat.updateMessageStatus(chat.list[channel.identity][key], error);
           }
        });
    };

    /**
     * Set chat title after select channel
     */
    chat.setTitle = function () {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile) {
            chat.clearTitle();
            return;
        }

        if (isUndefined(chats.data[activeProfile.inner.uid]) || isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity])) {
            chat.clearTitle();
            return;
        }

        var memberProfile = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile,
            modelProfile = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;

        if (!memberProfile) {
            chat.clearTitle();
            return;
        }

        var tpl = getTemplate(template.chatTitleTemplate, {
            identity: activeChat.identity,
            uid: memberProfile.uid,
            importUid: activeProfile.inner.uid,
            thumbnail: getProfileThumbnail(memberProfile),
            username: _.escape(memberProfile.first_name),
            modelBanned: (modelProfile && modelProfile.status == CHANNEL_STATUS_BANNED) ? 'active' : ''
        });

        this.titleContainer.removeClass('online');
        this.titleContainer.addClass('offline');
        this.titleContainer.html(tpl);

        var chatCounters = chats.counters[activeProfile.inner.uid];
        var favouritesCount = chatCounters ? chatCounters.favouritesCount || 0 : 0;
        chat.toggleOnline(memberProfile.uid, chats.data[activeProfile.inner.uid][activeChat.identity].isMemberOnline);
        chats.toggleFavorite(activeChat.identity, chats.data[activeProfile.inner.uid][activeChat.identity].isFavorite, favouritesCount);
    };

    /**
     * Update chat title after update chat member
     */
    chat.titleContainerUpdate = function () {
        var activeChat = chats.getActive()
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile) {
            chat.clearTitle();
            return;
        }

        if (isUndefined(chats.data[activeProfile.inner.uid]) || isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity])) {
            chat.clearTitle();
            return;
        }

        var memberProfile = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;

        if (!memberProfile) {
            chat.clearTitle();
            return;
        }

        var bgImg = this.titleContainer.find('.profiles_avatar').attr('style');
        var newBg = getProfileThumbnail(memberProfile);

        if (bgImg != 'background-image: url(\'' + newBg + '\')') {
            this.titleContainer.find('.profiles_avatar').attr('style', 'background-image: url(\'' + getProfileThumbnail(memberProfile) + '\')');
            info.container.find('.profiles_avatar').attr('style', 'background-image: url(\'' + getProfileThumbnail(memberProfile) + '\')');
        }

        var chatCounters = chats.counters[activeProfile.inner.uid];
        var favouritesCount = chatCounters ? chatCounters.favouritesCount || 0 : 0;
        this.titleContainer.find('.profiles_username_text').text(_.escape(memberProfile.first_name));
        info.container.find('.profiles_username_text').text(_.escape(memberProfile.first_name));
        chat.toggleOnline(memberProfile.uid, chats.data[activeProfile.inner.uid][activeChat.identity].isMemberOnline);
        chats.toggleFavorite(activeChat.identity, chats.data[activeProfile.inner.uid][activeChat.identity].isFavorite, favouritesCount);
    };

    /**
     * Remove title
     */
    chat.clearTitle = function () {
        this.titleContainer.html('');
    };

    /**
     * Add or update list of chats
     * @param chat
     * @param ownerUid
     */
    chats.setChatData = function (chat, ownerUid) {
        if (!ownerUid) {
            return;
        }

        if (isUndefined(chats.data[ownerUid])) {
            chats.data[ownerUid] = {};
        }

        var isNew = (isUndefined(chats.data[ownerUid][chat.identity]));
        var lastConsumeIndex = 0;
        var modelProfile = getModelProfileFromChannel(chat, ownerUid);
        var modelUid = modelProfile && !isUndefined(modelProfile.uid) ? modelProfile.uid : null;

        if (!isUndefined(chat.message) && Object.keys(chat.message).length > 0) {
            Object.keys(chat.message).forEach(function (key) {
                var body = getMessageBody(chat.message[key]);
                chat.message[key].body = _.escape(body);

                if (modelUid !== null && chat.message[key].uid == modelUid) {
                    lastConsumeIndex = (isUndefined(chat.message[key].lastConsumeIndex))
                        ? lastConsumeIndex
                        : chat.message[key].lastConsumeIndex;
                }
            });
        }

        chats.list[chat.identity] = chat;
        tasks.updateTaskChannel(chat);

        chats.data[ownerUid][chat.identity] = {
            lastActivity: chat.lastActivity,
            modelProfile: modelProfile,
            memberProfile: getOpponentProfileFromChannel(chat, ownerUid),
            isMemberOnline: (isNew) ? false : chats.data[ownerUid][chat.identity].isMemberOnline,
            lastConsumeMessage: lastConsumeIndex,
            isFavorite: (!isUndefined(chat.favorite)) ? chat.favorite : CHANEL_NOT_FAVORITE,
            unAnswered: chat.unAnswered === true,
        };

        if (chats.getActive() && chats.getActive().identity == chat.identity) {
            chats.active = chat;
        }

        input.toggleFilesInputDisable();
        input.toggleFilesInputDisableOnBalanceFree();
    };

    chats.removeUnAnsweredChats = (importUid) => {
        if (
            isUndefined(chats.filters[importUid]) ||
            chats.filters[importUid].unAnswered !== true ||
            isUndefined(chats.data[importUid])
        ) {
            return;
        }

        Object.keys(chats.data[profiles.getActive().inner.uid]).forEach(function (key) {
            if (!chats.data[importUid][key].unAnswered) {
                delete chats.data[importUid][key];

                if (chats.list[key]) {
                    delete chats.list[key];
                }

                if (chats.list[key]) {
                    delete chats.list[key];
                }
            }
        });

        if (Object.keys(chats.data[importUid]).length <= 0) {
            delete chats.data[importUid];
        }
    };

    /**
     * Select messages of chat
     */
    chats.setChats = function () {
        chats.removeUnAnsweredChats(profiles.getActive().inner.uid);

        if (isUndefined(chats.data[profiles.getActive().inner.uid])) {
            addEmpty(chats.container, {text: 'Chat list is empty.'});
            input.removePreloader();
            return;
        }

        var sort = sortObject(chats.data[profiles.getActive().inner.uid], 'lastActivity', true);
        var position = 0;
        var selectedChat = null;

        sort.map(function (key) {
            if (!isUndefined(chats.list[key])) {
                chats.addChat(chats.list[key], position);

                if (!chats.getActive() && position <= 0 && !queryParams.identity && !isResponsive()) {
                    selectedChat = chats.list[key].identity;
                }

                if (queryParams.identity && queryParams.identity === chats.list[key].identity) {
                    selectedChat = chats.list[key].identity;
                }

                position++;
            }
        });

        if (selectedChat) {
            chats.selectChat(selectedChat);
            emitStreamProfileChannels(Object.keys(chats.list).map(function (key) {
                return {identity: chats.list[key].identity};
            }));
        } else if (!selectedChat) {
            chats.getChatOrCreateNewFromQuery(queryParams, updateSubscribedChannelsAfterGetNew);
        }

    };

    /**
     * Try to get chat by query params or create new
     *
     * @param {Object} params
     * @param {null|function} cb
     * @return {boolean}
     */
    chats.getChatOrCreateNewFromQuery = function (params, cb) {
        if (!params.identity || !params.userUid || !params.ownerUid || !params.profileUid) {
            chats.removePreloader();
            input.removePreloader();
            return false;
        }
        chats.addPreloader(false, true);

        socket.instance.getMemberChannel(params, function (data, error) {
            chats.removePreloader(false);

            if (error) {
                alertError(error.text ? error.text : 'Can\'t get chat with user ID: ' + params.userUid);

                var firstChatIdentity = (!isUndefined(Object.keys(chats.list)[0])) ? Object.keys(chats.list)[0] : null;

                if (firstChatIdentity) {
                    chats.selectChat(firstChatIdentity);
                }

                return false;
            }

            chats.setChatData(data[0], params.ownerUid);
            chats.setChats();

            if (typeof cb === 'function') {
                cb(data[0]);
            }
        });
    };

    /**
     * Select chat and upload chat messages
     * @param identity
     */
    chats.selectChat = function (identity) {
        var activeProfile = profiles.getActive();
        var exist = (!isUndefined(chats.data[activeProfile.inner.uid]) && !isUndefined(chats.data[activeProfile.inner.uid][identity]));

        if (!exist) {
            return;
        }

        var element = chats.container.find('[data-identity="' + identity + '"]'),
            chatData = chats.data[activeProfile.inner.uid][identity],
            chatCounters = chats.counters[activeProfile.inner.uid] || {};

        // updateUserActiveDataByUid(
        //     chatData.memberProfile.uid,
        //     function (data) {
        //         if (data.success) {
        //             updateFilesSelectByFreeBalance(data.data.balance_free, data.data.purchase_type);
        //             info.data[chatData.memberProfile.uid] = data.data;
        //             realTimeAttributesUpdate(data.data);
        //         }
        //     }
        // );

        if (element.hasClass('active')) {
            return;
        }

        // scrollToView(element);

        var className = element.attr('class');

        chats.container.find('.' + className + '.active').removeClass('active');

        element.addClass('active');

        chats.active = chats.list[identity];

        chat.container.html('');
        media.container.html('');
        chat.addPreloader();

        input.disableInput();
        input.clearTyping();
        input.clearTextFieldError();

        chat.setTitle();
        info.getActiveUserData();

        comments.clear();
        comments.getActiveUserComments();

        profileMedia.clear();
        profileMedia.getActiveUserMedia();

        chats.setChatToHistory(chats.getActive());

        if (!isResponsive()) {
            updateFetalTabOnMobVersionAfterReRender();
        } else {
            document.dispatchEvent(new CustomEvent('resizeWithSream', {}));
        }


        if (!isUndefined(chat.list[identity]) && !isUndefined(chat.data[identity]) && chat.data[identity].loaded) {
            var dayFormat = null,
                lastMessage = null;

            Object.keys(chat.list[identity]).forEach(function (key) {
                chat.addOrUpdateMessage(identity, chat.list[identity][key]);

                lastMessage = chat.list[identity][key];

                if (dayFormat === null) {
                    dayFormat = getMessageDayFormat(chat.list[identity][key].created);
                }

                var currentDay = getMessageDayFormat(chat.list[identity][key].created);

                if (currentDay != dayFormat) {
                    chat.addDateLine(dayFormat, chat.list[identity][key].sid, true);
                    dayFormat = currentDay;
                }
            });

            if (dayFormat && lastMessage) {
                chat.addDateLine(dayFormat, lastMessage.sid);
            }

            chat.container.scrollTop(chat.container[0].scrollHeight);

            chat.removePreloader();
            input.addTextField();

            chat.toggleOnline(chatData.memberProfile.uid, chatData.isMemberOnline);
            chats.toggleFavorite(identity, chatData.isFavorite, chatCounters.favouritesCount || 0);

            media.renderMediaFiles();

            if (chat.disconnectedChats.indexOf(identity) >= 0) {
                chat.removeDisconnectedChats(identity);
                chat.getNewbieChatMessages(activeProfile.inner.uid, identity);
            }

            input.setStickerMessageAnimation('selectChat');
        } else {
            media.addPreloader();
            socket.instance.getChannelMessages(activeProfile.inner.uid, identity, function (data, error) {
                chat.receivedMessages(identity, data, error);

                if (isUndefined(chat.data[identity])) {
                    return;
                }

                chat.data[identity].loaded = true;
                chat.container.scrollTop(chat.container[0].scrollHeight);
                chat.toggleOnline(chatData.memberProfile.uid, chats.data[activeProfile.inner.uid][identity].isMemberOnline);
                chats.toggleFavorite(
                    identity,
                    chats.data[activeProfile.inner.uid][identity].isFavorite,
                    chatCounters.favouritesCount || 0
                );

                input.addTextField();

                setTimeout(function () {
                    chat.consumeMessages();
                }, 500);
            });
        }

        socket.instance.getFavouriteChannelsCount(activeProfile.inner.uid, function (data, error) {
            chats.updateFavouritesCount(data);

            chats.toggleFavorite(
                identity,
                chats.data[activeProfile.inner.uid][identity].isFavorite,
                chatCounters.favouritesCount || 0
            );
        });

        media.getMediaFiles();
        input.checkVirtualGift();
        input.checkWink();
        input.checkSticker();
    };

    /**
     * Push chat data to history
     *
     * @param activeChat
     */
    chats.setChatToHistory = function (activeChat) {
         var data = {};

         if (!profiles.getActive() || !profiles.getActive().inner || !profiles.getActive().inner.uid) {
             return;
         }

         data[URL_OWNER_UID_PARAMETER] = profiles.getActive().inner.uid;

         var chatsData = (!isUndefined(chats.data[profiles.getActive().inner.uid]))
             ? chats.data[profiles.getActive().inner.uid]
             : null;

         if (!chatsData || isUndefined(chatsData[activeChat.identity])) {
             return;
         }

         var chatData = chatsData[activeChat.identity];

         if (chatData.modelProfile && chatData.modelProfile.uid) {
             data[URL_PROFILE_UID_PARAMETER] = chatData.modelProfile.uid;
         }

         if (chatData.memberProfile && chatData.memberProfile.uid) {
             data[URL_USER_UID_PARAMETER] = chatData.memberProfile.uid;
         }

         goToMessages();
         pushToLocationHistory(data);
    };

    /**
     * Toggle online storage
     * @param uids
     * @param online
     */
    chats.toggleOnlineStatusInStorage = function (uids, online) {
        if (chats.data && Object.keys(chats.data).length > 0) {
            Object.keys(chats.data).forEach(function (ownerUid) {
                var chatsList = chats.data[ownerUid];

                if (chatsList && Object.keys(chatsList).length > 0) {
                    Object.keys(chatsList).forEach(function (identity) {
                        var chat = chatsList[identity];

                        if (typeof uids === "object" && uids.indexOf(chat.memberProfile.uid) >= 0) {
                            chats.data[ownerUid][identity].isMemberOnline = !!(online);
                        } else if (typeof uids !== "object" && chat.memberProfile.uid == uids) {
                            chats.data[ownerUid][identity].isMemberOnline = !!(online);
                        }
                    });
                }
            });
        }

        if (tasks.users) {
            Object.keys(uids).forEach(function (key) {
                if (!tasks.users[uids[key]]) {
                    tasks.users[uids[key]] = {
                        isOnline: false,
                    };
                }
                tasks.users[uids[key]].isOnline = !!(online);
            });
        }
    };

    chats.setChatFavorite = function (identity) {
        var activeProfile = profiles.getActive();

        if (!activeProfile || isUndefined(chats.data[activeProfile.inner.uid][identity])) {
            return;
        }

        var isFavorite = chats.data[activeProfile.inner.uid][identity].isFavorite;
        var newFavoriteStatus = (isFavorite === CHANEL_NOT_FAVORITE) ? CHANEL_FAVORITE : CHANEL_NOT_FAVORITE;
        var chatCounters = chats.counters[activeProfile.inner.uid] || {};
        var favouritesCount = chatCounters.favouritesCount || 0;
        var newFavouritesCount = newFavoriteStatus === CHANEL_FAVORITE ? favouritesCount + 1 : favouritesCount - 1;
        if (newFavoriteStatus === CHANEL_FAVORITE && favouritesCount >= FAVOURITES_LIMIT) {
            return;
        }

        chats.data[activeProfile.inner.uid][identity].isFavorite = newFavoriteStatus;
        chats.list[identity].favorite = newFavoriteStatus;
        chats.counters[activeProfile.inner.uid].favouritesCount = newFavouritesCount;

        chats.toggleFavorite(identity, newFavoriteStatus, newFavouritesCount);

        socket.instance.toggleFavorite(activeProfile.inner.uid, identity, newFavoriteStatus, function (error, data) {
            if (error) {
                chats.data[activeProfile.inner.uid][identity].isFavorite = isFavorite;
                chats.list[identity].favorite = isFavorite;
                chats.counters[activeProfile.inner.uid].favouritesCount = favouritesCount;
                chats.toggleFavorite(identity, isFavorite, favouritesCount);
            }
        });
    };

    /**
     * Toggle favorite chanel status in a backend
     * @param identity
     */
    chats.toggleChannelFavorite = function (identity, event) {
        var favBtn = $(event.target).closest('.favorite');

        if (favBtn.hasClass('disabled-fav')) {
            showFavTooltip(favBtn, FAVOURITES_LIMIT_TITLE);
            return;
        }

        if (tasks.active) {
            tasks.setChatFavorite(identity);
        } else {
            chats.setChatFavorite(identity);
        }
    };

    /**
     * Render filter view
     */
    chats.setFilter = function () {
        chats.showFilterView();
        chats.clearFilterView();

        var activeProfile = profiles.getActive();

        if (!activeProfile) {
            return;
        }

        var filters = (!isUndefined(chats.filters[activeProfile.inner.uid])) ? chats.filters[activeProfile.inner.uid] : {};

        chats.setFilterView(filters);
    };

    chats.updateSettings = function() {
        var settingsWrap = $('.chats-settings');

        if (!settingsWrap)
            return;

        var excludeWinkSetting = settingsWrap.find('#excludeWinkSettings'),
            isExclude = excludeWinkSetting.prop("checked"),
            status = (isExclude) ? WINK_EXCLUDE : WINK_SHOW;

        settingsWrap.removeClass('open');
        settingsWrap.find('.dropdown-backdrop').remove();

        if (chats.settings.winkExclude != status) {
            chats.settings.winkExclude = status;
            main.container.addClass('chat-reload');
            addPreloader(false, true, main.container);
            $.ajax({
                url: '/chats/settings/',
                data: {exclude: chats.settings.winkExclude},
                method: 'POST',
            });

            socket.instance.closeConnectionFinally();

            profiles.lastNewCountUpdateTime = 0;
            profiles.outer = {};
            profiles.active = null;
            profiles.disconnectedProfiles = [];
            profiles.loaded = [];
            chats.data = {};
            chats.list = {};
            chats.active = null;
            chat.data = {};
            chat.list = {};
            chat.active = null;
            chat.disconnectedChats = [];
            input.emoji = null;
            input.data = {};
            input.disabled = false;
            input.editable = {};
            input.communicationFiles = {};
            info.data = {};
            socket.instance = null;
            socket.isConnected = false;
            socket.isAuthorized = false;

            profiles.container.slick('unslick');
            profileSliderInitStatus = 0;
            profiles.container.html('');

            chats.container.html('');
            input.container.html('');
            info.container.html('');

            socket.initSocket();
            main.container.removeClass('chat-reload');
            removePreloader(false, main.container);
        }
    };

    /**
     * Remove filters
     */
    chats.clearFilter = function () {
        var activeProfile = profiles.getActive();

        if (!activeProfile) {
            return;
        }

        if (!isUndefined(chats.filters[activeProfile.inner.uid])) {
            if (chats.filters[activeProfile.inner.uid].favorite) {
                chats.filters[activeProfile.inner.uid] = {
                    favorite: chats.filters[activeProfile.inner.uid].favorite,
                    unAnswered: chats.filters[activeProfile.inner.uid].unAnswered,
                    uid: '',
                    username: ''
                };
            } else {
                delete chats.filters[activeProfile.inner.uid];
            }

            var isLoaded = profiles.loaded.indexOf(activeProfile.inner.uid);

            if (isLoaded >= 0) {
                profiles.loaded.splice(isLoaded, 1);
            }

            $('.profiles[data-uid="' + activeProfile.inner.uid + '"]').removeClass('active');

            profiles.selectProfile(activeProfile.inner.uid);
        }

        chats.clearFilterView();
    };

    /**
     * Upload profiles after filter update
     */
    chats.addFilter = function () {
        var activeProfile = profiles.getActive();
        var activeChat = chats.getActive();

        if (!activeProfile) {
            return;
        }

        var filter = chats.validateFilterData();

        if (!filter) {
            return;
        }

        chats.filters[activeProfile.inner.uid] = filter;

        chats.setFilterView(chats.filters[activeProfile.inner.uid]);

        var filterWrap = $('.chats-filter');
        filterWrap.removeClass('open');
        filterWrap.find('.dropdown-toggle').attr('aria-expanded', false);

        var isLoaded = profiles.loaded.indexOf(activeProfile.inner.uid);

        if (isLoaded >= 0) {
            profiles.loaded.splice(isLoaded, 1);
        }

        if (activeChat && !isUndefined(chat.data[activeChat.identity])) {
            delete chat.data[activeChat.identity];
        }

        if (activeChat && !isUndefined(chat.list[activeChat.identity])) {
            delete chat.list[activeChat.identity];
        }

        if (!isUndefined(chats.data[activeProfile.inner.uid])) {
            delete chats.data[activeProfile.inner.uid];
        }

        if (activeChat && !isUndefined(chats.list[activeChat.identity])) {
            delete chats.list[activeChat.identity];
        }

        $('.profiles[data-uid="' + activeProfile.inner.uid + '"]').removeClass('active');
        chats.container.html('');

        queryParams = {
            ownerUid: activeProfile.inner.uid
        };

        profiles.selectProfile(activeProfile.inner.uid);
    };

    /**
     * Filter data validation
     * @returns {boolean|{uid: *, favorite: *, username: *}}
     */
    chats.validateFilterData = function () {
        var filterWrap = $('.chats-filter');

        if (!filterWrap || filterWrap.length <= 0)
            return false;

        var username = filterWrap.find('#usernameFilter').val(),
            uid = filterWrap.find('#userIdFilter').val();

        if (username && username.length > 0)
            username = username.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        else
            username = '';

        if (uid && uid.length > 0) {
            uid = uid.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
            var reg = /^\d+$/;

            if (!reg.test(uid)) {
                filterWrap.find('#userIdFilter').parent().addClass('has-error');
                filterWrap.find('#userIdFilter').after('<div class="text-danger">User ID must contain only numbers.</div>');
                return false;
            }
        } else
            uid = '';

        return {
            username: username,
            uid: uid,
            favorite: $('#onlyFavoriteFilter').prop('checked'),
            unAnswered: $('#unAnsweredIdFilter').prop('checked'),
        };
    };

    /**
     * Clear filter view
     */
    chats.clearFilterView = function() {
        var filterWrap = $('.chats-filter');

        if (!filterWrap || filterWrap.length <= 0) {
            return;
        }

        filterWrap.find('.count-filters').text('0');
        filterWrap.find('.count-filters').addClass('hidden');
        filterWrap.find('#usernameFilter').val('');
        filterWrap.find('#userIdFilter').val('');
        filterWrap.find('#unAnsweredIdFilter').prop('checked', false);

        filterWrap.find('.has-error').removeClass('has-error');
        filterWrap.find('.text-danger').remove();
    };

    /**
     * Clear filter view
     */
    chats.setFilterView = function(filters) {
        var filterWrap = $('.chats-filter'),
            count = 0;

        if (!filterWrap || filterWrap.length <= 0) {
            return;
        }

        if (!isUndefined(filters.username) && filters.username.length > 0) {
            filterWrap.find('#usernameFilter').val(filters.username);
            count++;
        } else {
            filterWrap.find('#usernameFilter').val('');
        }

        if (!isUndefined(filters.uid) && filters.uid.length > 0) {
            filterWrap.find('#userIdFilter').val(filters.uid);
            count++;
        } else {
            filterWrap.find('#userIdFilter').val('');
        }

        $('#onlyFavoriteFilter').prop('checked', (!isUndefined(filters.favorite) && filters.favorite));
        $('#unAnsweredIdFilter').prop('checked', (!isUndefined(filters.unAnswered) && filters.unAnswered));
        count += (!isUndefined(filters.unAnswered) && filters.unAnswered) ? 1 : 0;

        if (count > 0) {
            filterWrap.find('.count-filters').text(count);
            filterWrap.find('.count-filters').removeClass('hidden');
        }
    };

    chats.showFilterView = function () {
        var filterWrap = $('.chats-filter');
        var filterFavoriteWrap = $('.chats-filter-favorite');

        if (filterWrap.hasClass('hidden')) {
            filterWrap.removeClass('hidden');
        }

        if (filterFavoriteWrap.hasClass('hidden')) {
            filterFavoriteWrap.removeClass('hidden');
        }
    }

    chats.hideFilterView = function () {
        var filterWrap = $('.chats-filter');
        var filterFavoriteWrap = $('.chats-filter-favorite');

        if (filterWrap.length > 0) {
            filterWrap.addClass('hidden');
        }

        if (filterFavoriteWrap.length > 0) {
            filterFavoriteWrap.addClass('hidden');
        }
    };
    /**
     * @param chat
     * @param ignoreWinkFilter
     * @param ignoreUnAnswered
     * @returns {boolean}
     */
    chats.isChatActualByFilterOrSettings = function (chat, ignoreWinkFilter, ignoreUnAnswered) {
        if (!chat || !chat.members) {
            return true;
        }

        var opponent = null;
        var model = null;
        var favorite = (chat.favorite && chat.favorite === CHANEL_FAVORITE);
        var unAnswered = (chat.unAnswered && chat.unAnswered === true);

        Object.keys(chat.members).forEach(function (key) {
            if (!isUndefined(chat.members[key]) && !isUndefined(chat.members[key].import_uid) && !isUndefined(profiles.data[chat.members[key].import_uid])) {
                opponent = getOpponentProfileFromChannel(chat, chat.members[key].import_uid);
                model = getModelProfileFromChannel(chat, chat.members[key].import_uid);
            }
        });

        if (opponent === null || model === null) {
            return true;
        }

        if (!isUndefined(chats.filters[model.import_uid])) {
            var filters = chats.filters[model.import_uid];

            if (filters.username && filters.username.length > 0) {
                var regex = new RegExp([".*", filters.username, ".*"].join(''), "i");

                if (!regex.test(opponent.username)) {
                    return false;
                }
            }

            if (filters.uid && filters.uid.length > 0 && filters.uid != opponent.uid) {
                return false;
            }

            if (filters.favorite && !favorite) {
                return false;
            }

            if (filters.unAnswered) {
                if (!ignoreUnAnswered && !unAnswered) {
                    return false;
                } else if (ignoreUnAnswered && !unAnswered && isUndefined(chats.list[chat.identity])) {
                    return false;
                }
            }
        }

        if (chats.settings.winkExclude != WINK_SHOW && !ignoreWinkFilter) {
            if (isUndefined(opponent.writeNotWink) || !opponent.writeNotWink) {
                return false;
            }
        }

        return true;
    };

    /**
     * Remove active chat
     */
    chats.removeActiveChat = function () {
        if (chats.getActive()) {
            chats.container.find('[data-identity="' + chats.getActive().identity + '"]').removeClass('active');
            chats.active = null;
        }
    };

    /**
     * Add input field
     */
    input.addTextField = function () {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat) {
            return;
        }

        var modelProfile = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;
        var modelBanned = (modelProfile && modelProfile.status === CHANNEL_STATUS_BANNED);

        if (isUndefined(input.data[activeChat.identity])) {
            input.data[activeChat.identity] = {
                text: '',
                files: [],
                communication: [],
                messageType: null
            };
        }

        if (!input.emoji) {
            var tmp = getTemplate(
                templates.inputFieldTemplate,
                {
                    message: '',
                    disabledFiles: (!isAvailableToSendFiles()) ? 'disabled="disabled"' : '',
                    disabledDisappearedFiles: 'disabled="disabled"'
                }
            );

            this.container.html(tmp);
            input.emoji = this.container.find(templates.inputFieldId).emojioneArea({
                pickerPosition: "top",
                search: false,
                tones: false
            });

            input.emoji[0].emojioneArea.on("keyup", function (editor, event) {
                if (input.disabled) {
                    event.preventDefault();
                    return false;
                }

                var shiftKeyPressed = event.shiftKey,
                    keyCode = event.key || event.keyCode;

                if ((keyCode == 'Enter' || keyCode == 13) && !shiftKeyPressed) {
                    //event.preventDefault();
                    //input.sendMessage();
                    return;
                }

                if (chats.getActive().identity && !input.disabled) {
                    if (!isUndefined(input.editable[chats.getActive().identity])) {
                        input.editable[chats.getActive().identity].text = this.getText();
                    } else {
                        input.data[chats.getActive().identity].text = this.getText();
                    }

                    input.typing(chats.getActive().identity, profiles.getActive().inner.uid);
                }

                input.resizeChatWrap(true);
            }).on('emojibtn.click', function (editor, event) {
                if (input.disabled) {
                    event.preventDefault();
                    return false;
                }

                if (chats.getActive().identity && !input.disabled) {
                    if (!isUndefined(input.editable[chats.getActive().identity])) {
                        input.editable[chats.getActive().identity].text = this.getText();
                    } else {
                        input.data[chats.getActive().identity].text = this.getText();
                    }
                }

                input.resizeChatWrap(true);
            }).on('keypress', function (editor, event) {
                if (input.disabled) {
                    event.preventDefault();
                    return false;
                }

                var shiftKeyPressed = event.shiftKey,
                    keyCode = event.key || event.keyCode;

                if ((keyCode == 'Enter' || keyCode == 13) && !shiftKeyPressed) {
                    event.preventDefault();
                    if (input.container.find('button#save-button').is(':visible')) {
                        input.updateMessage();
                    } else {
                        input.sendMessage();
                    }

                    return;
                }
            });
        }

        input.disableInput();

        if (!isUndefined(input.editable[activeChat.identity])) {
            input.emoji[0].emojioneArea.setText(_.escape(input.editable[activeChat.identity].text));
            input.activeEditMessage(input.editable[activeChat.identity].sid);
            input.clearSelectedFiles();
            input.enableInput();
            input.resizeChatWrap(true);
        } else {
            input.clearEditableView();
            input.enableInput();
            input.emoji[0].emojioneArea.setText(_.escape(input.data[activeChat.identity].text));
            input.renderSelectedFiles();
            input.setCountCommunication();
            input.resizeChatWrap();
        }
        input.toggleFilesInputDisable();
        input.toggleFilesInputDisableOnBalanceFree();

        modelBanned && input.disableInput(modelBanned);
    };

    /**
     * Disable input fields
     */
    input.disableInput = function (modelBanned = false) {
        input.disabled = true;
        input.container.find(templates.inputFieldId).prop('disabled', 'disabled');
        input.container.find('.virtual-gift-btn').addClass('hidden');
        // input.container.find('input').prop('disabled', 'disabled');
        // input.container.find('button#send-button').prop('disabled', 'disabled');

        if (input.emoji && input.emoji[0]) {
            input.emoji[0].emojioneArea.disable();
        }

        modelBanned && input.container.hide();
    };

    /**
     * Enable input fields
     */
    input.enableInput = function () {
        input.disabled = false;
        input.container.find(templates.inputFieldId).prop('disabled', false);
        input.container.find('.virtual-gift-btn').removeClass('hidden');
        // input.container.find('input').prop('disabled', false);
        // input.container.find('button#send-button').prop('disabled', false);

        if (input.emoji && input.emoji[0]) {
            input.emoji[0].emojioneArea.enable();
        }

        input.container.show();
    };

    /**
     * Disable/enable input file fields
     */
    input.toggleFilesInputDisable = function () {
        if (isAvailableToSendFiles()) {
            enableFilesSelect();
        } else {
            disableFilesSelect();
        }
    };

    /**
     * Disable input file fields if now allowed balance_free
     */
    input.toggleFilesInputDisableOnBalanceFree = function () {
        checkFilesSelectionAvailabilityDependingOnFreeBalance();
    };

    /**
     * Send typing event to api
     * @param identity
     * @param ownerUid
     */
    input.typing = function (identity, ownerUid) {
        if (isUndefined(chats.data[ownerUid]) || isUndefined(chats.data[ownerUid][identity]))
            return;

        input.clearTextFieldError();

        socket.instance.typing(identity, chats.data[ownerUid][identity].memberProfile.uid, chats.data[ownerUid][identity].modelProfile.uid);
    };

    /**
     * Show typing in view
     * @param channel
     * @param member
     */
    input.typingStart = function (channel, member) {
        var active = chats.getActive();

        if (!active || active.identity != channel.identity) {
            return;
        }

        var typing = this.container.find(templates.typingWrapTemplate);
        var members = chats.list[channel.identity].members;
        var text = null;

        if (!members || Object.keys(members).length <= 0) {
            return;
        }

        Object.keys(members).forEach(function (key) {
            if (members[key].uid == member.uid) {
                text = _.escape(members[key].first_name) + ' is typing ...';
            }
        });

        if (text) {
            typing.text(text);
            typing.removeClass('hidden');
        }
    };

    /**
     * Stop typing
     * @param channel
     */
    input.typingEnd = function (channel) {
        var active = chats.getActive();

        if (!active || active.identity != channel.identity) {
            return;
        }

        input.clearTyping();
    };

    /**
     * Clear typing
     */
    input.clearTyping = function () {
        this.container.find(templates.typingWrapTemplate).text('');
        this.container.find(templates.typingWrapTemplate).addClass('hidden');
    };

    /**
     * Clear text area
     */
    input.clearTextField = function () {
        if (!input.emoji || !input.emoji[0] || isUndefined(input.data[chats.getActive().identity])) {
            return;
        }

        if (
            [MESSAGE_TYPE_DISAPPEARING_VIDEO, MESSAGE_TYPE_DISAPPEARING_PHOTO]
                .indexOf(input.data[chats.getActive().identity].messageType) < 0
        ) {
            input.emoji[0].emojioneArea.setText('');
            input.data[chats.getActive().identity].text = '';
        }

        input.resizeChatWrap();

        input.data[chats.getActive().identity].files = [];
        input.data[chats.getActive().identity].messageType = null;
        input.clearSelectedFiles();
    };

    /**
     * Validate input data
     * @returns {{message: string, status: boolean}}
     */
    input.validateInputData = function () {
        var result = {
                status: false,
                message: ''
            };
        var activeChat = chats.getActive();

        if (!activeChat || !activeChat.identity) {
            result.message = 'Please select the chat in which you want to write a message.';
            return  result;
        }

        var data = input.data[activeChat.identity];

        if (!data || (!data.text && !data.files) || (!data.text && !data.communication)) {
            result.message = 'Message can\'t be empty.';
            return result;
        }

        let validateBodyResult = input.validateMessageBody(data.text, data);
        if (!validateBodyResult.status) {
            return validateBodyResult;
        }

        result.status = true;

        return result;
    };

    input.validateMessageBody = function (body, data = {}) {
        let result = {
                status: false,
                message: ''
            },
            text = body.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');

        if (text.length <= 0 && (!data.files || Object.keys(data.files).length <= 0) && (!data.communication || Object.keys(data.communication).length <= 0)) {
            result.message = 'Message can\'t be empty.';
            return result;
        }

        if (text.length > MAX_MESSAGE_SYMBOLS) {
            result.message = 'Maximum symbols per one message can\'t be more than ' + MAX_MESSAGE_SYMBOLS + '.';
            return result;
        }

        result.status = true;

        return result;
    }

    /**
     * Send new message to user
     */
    input.sendMessage = function () {
        if (input.disabled) {
            input.addTextFieldError('Can\'t send message now. Please try again after few seconds.', 2);
            return;
        }

        removeEmpty(chats.container);

        var valid = input.validateInputData();
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile) {
            return;
        }

        var author = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;
        var opponent = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;

        if (valid.status === false) {
            input.addTextFieldError(valid.message, 2);
            return;
        }

        var message = input.data[activeChat.identity].text.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        var media = input.data[activeChat.identity].files;
        var communicationMedia = input.data[activeChat.identity].communication;
        var tempKey = socket.instance.getMessageTempKey(activeChat.identity);
        var tmpMessage = input.getTempMessageModel(
            activeChat.identity,
            author,
            opponent,
            (
                (media && Object.keys(media).length > 0) ||
                (communicationMedia && Object.keys(communicationMedia).length > 0)
            ) ?
                (input.data[activeChat.identity].messageType || MESSAGE_TYPE_MEDIA) :
                MESSAGE_TYPE_TEXT,
            message,
            media,
            communicationMedia,
            null,
            null,
            tempKey
        );

        chat.setChatMessages(activeChat.identity, [tmpMessage], true);
        input.clearTextField();
        input.clearCommunicationFiles();
        chat.scrollAfterNewMessageReceived();

        if (media && Object.keys(media).length > 0) {
            if (communicationMedia && Object.keys(communicationMedia).length > 0) {
                media = media.concat(communicationMedia);
            }

            input.pushMediaMessage(
                activeProfile.inner.uid,
                activeChat.identity,
                message,
                media,
                tempKey,
                tmpMessage
            );
        } else {
            socket.instance.sendNewMessage(
                activeProfile.inner.uid,
                activeChat.identity,
                tmpMessage.type,
                message,
                tmpMessage.media,
                null,
                null,
                tempKey,
                function (error, ownerUid, identity) {
                    if (error) {
                        tmpMessage.status = MESSAGE_DELIVERY_BROKE;

                        if (chats.getActive() && chats.getActive().identity == identity) {
                            input.addTextFieldError(
                                (error.message) ?
                                    error.message :
                                    'Can\'t send message please try again',
                                2
                            );
                        }

                        chat.setChatMessages(identity, [tmpMessage]);
                        return;
                    }
                }
            );
        }
    };

    input.sendStickerMessage = function (stickerUid) {
        if (input.disabled) {
            input.addTextFieldError('Can\'t send sticker now. Please try again after few seconds.', 2);
            return;
        }

        removeEmpty(chats.container);
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile) {
            return;
        }

        var author = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;
        var opponent = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;
        var tempKey = socket.instance.getMessageTempKey(activeChat.identity);
        var tmpMessage = input.getTempMessageModel(
            activeChat.identity,
            author,
            opponent,
            MESSAGE_TYPE_STICKER,
            null,
            null,
            null,
            null,
            { uid: stickerUid },
            tempKey
        );

        chat.setChatMessages(activeChat.identity, [tmpMessage], true);
        chat.scrollAfterNewMessageReceived();

        socket.instance.sendNewMessage(
            activeProfile.inner.uid,
            activeChat.identity,
            tmpMessage.type,
            '',
            tmpMessage.media,
            null,
            tmpMessage.sticker,
            tempKey,
            function (error, ownerUid, identity) {
                if (error) {
                    tmpMessage.status = MESSAGE_DELIVERY_BROKE;

                    if (chats.getActive() && chats.getActive().identity === identity) {
                        input.addTextFieldError(
                            (error.message) ?
                                error.message :
                                'Can\'t send sticker please try again',
                            2
                        );
                    }

                    chat.setChatMessages(identity, [tmpMessage]);
                }
            }
        );
    };

    /**
     * Send virtual gift message
     * @param {Object} giftData
     */
    input.sendGiftMessage = function (giftData) {
        if (input.disabled) {
            input.addTextFieldError('Can\'t send gift now. Please try again after few seconds.', 2);
            return;
        }

        removeEmpty(chats.container);
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile) {
            return;
        }

        var author = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;
        var opponent = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;

        var giftDataRequest = {
            uid: giftData.uid,
            actionType: giftData.isRequest ? GIFT_ACTION_TYPE_REQUEST : GIFT_ACTION_TYPE_SEND,
            status: GIFT_STATUS_NEW,
            src: giftData.src,
            title: giftData.title,
            body: giftData.body,
            price: giftData.price,
        };
        var tempKey = socket.instance.getMessageTempKey(activeChat.identity);
        var tmpMessage = input.getTempMessageModel(
            activeChat.identity,
            author,
            opponent,
            giftData.isRequest ? MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST : MESSAGE_TYPE_VIRTUAL_GIFT,
            null,
            null,
            null,
            giftDataRequest,
            null,
            tempKey
        );

        chat.setChatMessages(activeChat.identity, [tmpMessage], true);
        chat.scrollAfterNewMessageReceived();

        socket.instance.sendNewMessage(
            activeProfile.inner.uid,
            activeChat.identity,
            tmpMessage.type,
            '',
            tmpMessage.media,
            {
                uid: giftData.uid,
                title: giftData.title,
                body: giftData.body,
            },
            null,
            tempKey,
            function (error, ownerUid, identity) {
                if (error) {
                    if (chats.getActive().identity == identity) {
                        input.checkVirtualGift();
                    }

                    tmpMessage.status = MESSAGE_DELIVERY_BROKE;

                    if (chats.getActive() && chats.getActive().identity == identity) {
                        input.addTextFieldError((error.message) ? error.message : 'Can\'t send message please try again', 2);
                    }

                    chat.setChatMessages(identity, [tmpMessage]);
                    return;
                }
            }
        );
    };

    /**
     * Push media message to server
     * @param ownerUid
     * @param identity
     * @param message
     * @param media
     * @param tempKey
     * @param tmpMessage
     */
    input.pushMediaMessage = function (ownerUid, identity, message, media, tempKey, tmpMessage) {
        uploadChatFiles(ownerUid, identity, tempKey, media, function (error, ownerUid, identity, messageKey, file, fileResult) {
            input.updateMediaAfterUpload(error, identity, messageKey, file, fileResult);
            chat.updateMessageStatus(tmpMessage);

            if (!error && input.canPushMediaMessage(identity, messageKey)) {
                socket.instance.sendNewMessage(
                    ownerUid,
                    identity,
                    tmpMessage.type || MESSAGE_TYPE_MEDIA,
                    message,
                    media,
                    null,
                    null,
                    tempKey,
                    function (error, ownerUid, identity) {
                        if (error) {
                            tmpMessage.status = MESSAGE_DELIVERY_BROKE;

                            if (chats.getActive() && chats.getActive().identity == identity) {
                                input.addTextFieldError(
                                    (error.message) ?
                                        error.message :
                                        'Can\'t send message please try again',
                                    2
                                );
                            }

                            chat.setChatMessages(identity, [tmpMessage]);
                            return;
                        }
                    }
                );
            }
        });
    };

    /**
     * Validate sending of chat message
     * @param identity
     * @param sid
     * @returns {boolean}
     */
    input.canPushMediaMessage = function (identity, sid) {
        if (isUndefined(chat.list[identity]) || isUndefined(chat.data[identity].messages[sid]))
            return false;

        var send = true;

        Object.keys(chat.list[identity]).forEach(function (key) {
            if (isUndefined(chat.list[identity][key]) || chat.list[identity][key].sid != sid)
                return;

            if (chat.list[identity][key].status != MESSAGE_DELIVERY_SEND) {
                send = false;
                return;
            }

            if (
                [MESSAGE_TYPE_MEDIA, MESSAGE_TYPE_DISAPPEARING_PHOTO, MESSAGE_TYPE_DISAPPEARING_VIDEO]
                    .indexOf(chat.list[identity][key].type) >= 0
            ) {
                if (chat.list[identity][key].media && Object.keys(chat.list[identity][key].media).length > 0) {
                    Object.keys(chat.list[identity][key].media).forEach(function (mediaKey) {
                        if (isUndefined(chat.list[identity][key].media[mediaKey]) || chat.list[identity][key].media[mediaKey].status != FILE_STATUS_UPLOADED)
                            send = false;
                    });
                } else if ((!chat.list[identity][key].media || Object.keys(chat.list[identity][key].media).length <= 0) && chat.list[identity][key].body.length <= 0)
                    send = false;
            }
        });

        return send;
    };

    /**
     * Update media
     * @param error
     * @param identity
     * @param messageKey
     * @param file
     * @param fileResult
     */
    input.updateMediaAfterUpload = function(error, identity, messageKey, file, fileResult) {
        if (isUndefined(chat.list[identity]) || isUndefined(chat.data[identity].messages[messageKey]))
            return;

        Object.keys(chat.list[identity]).forEach(function(key) {
            if (isUndefined(chat.list[identity][key]) || chat.list[identity][key].sid !== messageKey)
                return;

            if (isUndefined(chat.list[identity][key].media) || Object.keys(chat.list[identity][key].media).length <= 0)
                return;

            Object.keys(chat.list[identity][key].media).forEach(function (mediaKey) {
                var media = chat.list[identity][key].media[mediaKey];

                if (!media)
                    return;

                if (error)
                    chat.list[identity][key].status = MESSAGE_DELIVERY_BROKE;

                var messageSid = null;

                if (media.isNew && media.index == file.index) {
                    chat.list[identity][key].media[mediaKey].status = (error) ? FILE_STATUS_ERROR : FILE_STATUS_UPLOADED;
                    messageSid = file.index;

                } else if (!media.isNew && media.sid == file.sid) {
                    chat.list[identity][key].media[mediaKey].status = (error) ? FILE_STATUS_ERROR : FILE_STATUS_UPLOADED;
                    messageSid = file.sid;
                }

                if (messageSid !== null && !error) {
                    chat.list[identity][key].media[mediaKey].file = fileResult;
                }

                if (chats.getActive() && chats.getActive().identity == identity && messageSid !== null) {
                    var messageWrap = getFileWrap(
                        chat.list[identity][key],
                        chat.list[identity][key].media[mediaKey],
                        true
                    );
                    var wrap = chat.container.find('.messages[data-sid="' + chat.list[identity][key].sid + '"]');

                    if (wrap && wrap.length > 0) {
                        wrap.find('.message-user__files[data-sid="' + messageSid + '"]').replaceWith(messageWrap);
                    }
                }
            });
        });
    };

    /**
     * Update upload file progress
     * @param total
     * @param current
     * @param file
     * @param identity
     */
    input.updateUploadProcess = function (total, current, file, identity) {
        if (chats.getActive().identity != identity) {
            return;
        }

        var mediaWrap = chat.container.find('.message-user__files.loading[data-sid="' + file.index + '"]');

        if (mediaWrap && mediaWrap.length > 0) {
            mediaWrap.find('.uploaded-size').text(parseFloat(current / 1024 / 1024).toFixed(2) + ' MB');
            mediaWrap.find('.total-size').text(parseFloat(total / 1024 / 1024).toFixed(2) + ' MB');

            var percent = (current * 100) / total;

            if (percent < 100) {
                mediaWrap.find('.upload-finished').attr('style', 'width: ' + percent + '%');
            } else if (percent >= 100) {
                mediaWrap.find('.upload-finished').attr('style', 'width: 100%');
                mediaWrap.addClass('processing');
            }
        }
    };

    /**
     * Start edit of message
     * @param sid
     */
    input.editMessage = function (sid) {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (
            !activeChat ||
            !activeProfile ||
            !sid ||
            isUndefined(chat.list[activeChat.identity]) ||
            Object.keys(chat.list[activeChat.identity]).length <= 0
        ) {
            return;
        }

        if (
            isUndefined(chats.data[activeProfile.inner.uid]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile)
        ) {
            return;
        }

        var message = null;
        var modelProfile = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;

        Object.keys(chat.list[activeChat.identity]).forEach(function (key) {
            if (isUndefined(chat.list[activeChat.identity][key]) || chat.list[activeChat.identity][key].sid != sid) {
                return;
            }

            if (
                chat.list[activeChat.identity][key].status != MESSAGE_DELIVERY_DELIVERED ||
                modelProfile.uid != chat.list[activeChat.identity][key].author.uid
            ) {
                return;
            }

            message = chat.list[activeChat.identity][key];
        });

        if (
            message === null ||
            (message.type == MESSAGE_TYPE_MEDIA && message.body.length <= 0) ||
            [MESSAGE_TYPE_WINK, MESSAGE_TYPE_GIFT, MESSAGE_TYPE_POSTCARD].indexOf(message.type) >= 0
        ) {
            return;
        }

        input.editable[activeChat.identity] = {
            sid: sid,
            text: _.escape(getMessageBody(message))
        };

        input.activeEditMessage(sid);
        input.clearSelectedFiles();

        if (input.emoji && input.emoji[0]) {
            input.emoji[0].emojioneArea.setText(_.escape(getMessageBody(message)));
        }
    };

    /**
     * Get message history
     * @param sid
     */
    chat.getMessageHistory = function (sid) {
        chat.closeMessageHistory();
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (
            !activeChat ||
            !activeProfile ||
            !sid ||
            isUndefined(chat.list[activeChat.identity]) ||
            Object.keys(chat.list[activeChat.identity]).length <= 0
        ) {
            return;
        }

        if (
            isUndefined(chats.data[activeProfile.inner.uid]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile)
        ) {
            return;
        }

        var tpl = getTemplate(
            template.messageHistoryTemplate,
            { sid: sid }
        );

        chat.container.find('.messages[data-sid="' + sid + '"]').append(tpl);

        socket.instance.getMessageHistory(sid, activeProfile.inner.uid, activeChat.identity, function (data, error) {
            if (error) {
                return;
            }

            chat.showMessageHistory(data);
        });
    };

    /**
     * Show message history
     * @param data
     */
    chat.showMessageHistory = function (data) {
        const { sid, messages, ownerUid, identity } = data,
            historyPopup = chat.container.find('.message-history-list[data-sid="' + sid + '"]'),
            modelProfile = chats.data[ownerUid][identity].modelProfile;

        historyPopup.find('.relative-preloader').hide();
        historyPopup.find('.message-history-list-wrap').append(
            chat.renderMessageHistory(messages, modelProfile.first_name)
        );
    }

    /**
     * Render message history list
     * @param messages
     * @param name
     * @returns {string}
     */
    chat.renderMessageHistory = function (messages, name) {
        const historyItems = [];

        for (let it = 0; it < messages.length; it++) {
            let message = messages[it];
            historyItems.push(
                getTemplate(
                    template.messageHistoryRowTemplate,
                    {
                        name: name,
                        body: message.body,
                        date: getDateFromTimestamp(message.createdAt / 1000, '-')
                    }
                )
            );
        }

        return historyItems.join('');
    }

    /**
     * Close message history popup
     */
    chat.closeMessageHistory = function() {
        $('.message-history-list').remove();
    }

    /**
     * Update edited message
     */
    input.updateMessage = function () {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile || isUndefined(input.editable[activeChat.identity])) {
            input.clearEditableView();
            return;
        }

        var message = null;
        var modelProfile = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;

        Object.keys(chat.list[activeChat.identity]).forEach(function (key) {
            if (
                isUndefined(chat.list[activeChat.identity][key]) ||
                chat.list[activeChat.identity][key].sid != input.editable[activeChat.identity].sid
            ) {
                return;
            }

            if (
                chat.list[activeChat.identity][key].status != MESSAGE_DELIVERY_DELIVERED ||
                modelProfile.uid != chat.list[activeChat.identity][key].author.uid
            ) {
                return;
            }

            message = chat.list[activeChat.identity][key];
            chat.list[activeChat.identity][key].body = input.editable[activeChat.identity].text;
        });

        if (
            message === null ||
            (message.type == MESSAGE_TYPE_MEDIA && message.body.length <= 0) ||
            [MESSAGE_TYPE_GIFT, MESSAGE_TYPE_WINK, MESSAGE_TYPE_VIRTUAL_GIFT, MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST, MESSAGE_TYPE_POSTCARD]
                .indexOf(message.type) >= 0
        ) {
            return;
        }

        var valid = input.validateMessageBody(input.editable[activeChat.identity].text);
        if (valid.status === false) {
            input.addTextFieldError(valid.message, 2);
            return;
        }

        socket.instance.updateMessage(
            activeProfile.inner.uid,
            activeChat.identity,
            message,
            input.editable[activeChat.identity].text,
            (message.type == MESSAGE_TYPE_MEDIA),
            function (error) {
                if (error) {
                    if (chats.getActive() && activeChat.identity == chats.getActive().identity) {
                        input.addTextFieldError((error.message) ? error.message : 'Can\'t send message please try again', 2);
                    }

                    chat.updateChatMessage(activeChat.identity, message);
                    return;
                }

                message.body = input.editable[activeChat.identity].text;
                message.edited = true;
                chat.updateChatMessage(activeChat.identity, message);

                input.clearEdit();
            });
    };

    /**
     * Remove edit message visualization
     */
    input.clearEdit = function () {
        var activeChat = chats.getActive();

        input.clearEditableView();

        if (activeChat && !isUndefined(input.editable[activeChat.identity])) {
            delete input.editable[activeChat.identity];
        }

        input.addTextField();
    };

    /**
     * Remove edit
     */
    input.clearEditableView = function() {
        chat.container.find('.messages.message-owner.editable').removeClass('editable');
        input.container.removeClass('editable');
    };

    /**
     * Visualize edit message
     * @param sid
     */
    input.activeEditMessage = function (sid) {
        var wrap = chat.container.find('.messages.message-owner[data-sid="' + sid + '"]');

        if (!wrap || wrap.length <= 0)
            return;

        chat.container.find('.messages.message-owner.editable').removeClass('editable');
        wrap.addClass('editable');

        input.container.addClass('editable');
    };

    input.fileDisappearedChangedHandler = function (event) {
        if (isUndefined(event.target) || isUndefined(event.target.files) || input.disabled) {
            return;
        }

        var files = event.target.files;
        var activeChat = chats.getActive();
        var time = (new Date()).getTime();
        var error = null;

        if (input.data[activeChat.identity].files.length > 0 && input.data[activeChat.identity].messageType === MESSAGE_TYPE_MEDIA) {
            input.showFileError(activeChat.identity, 'Please remove private media files before select disapperaing media file.');
            return;
        }

        if (input.data[activeChat.identity].files.length > 0 || files.length !== CHAT_MAX_DISAPPEARED_FILES) {
            input.showFileError(activeChat.identity, 'You can select only one file for disappearing message.');
            return;
        }

        var isVideo = false;
        Object.keys(files).forEach(function (key) {
            var fileKey = 'file_' + Object.keys(input.data[activeChat.identity].files).length + '_' + time;
            var file = files[key];
            var valid = isChatFileValid(file);

            if (valid.status) {
                input.data[activeChat.identity].files.push({
                    index: fileKey,
                    file: file,
                    type: valid.mediaType,
                    isNew: true,
                    status: FILE_STATUS_SEND
                });

                isVideo = valid.mediaType === TYPE_VIDEO;
            } else {
                error = ((error === null) ? valid.text : error + ' ' + valid.text);
            }
        });

        input.data[activeChat.identity].messageType = isVideo ?
            MESSAGE_TYPE_DISAPPEARING_VIDEO :
            MESSAGE_TYPE_DISAPPEARING_PHOTO;

        input.renderSelectedFiles();

        if (error !== null) {
            input.showFileError(activeChat.identity, error);
        }

        $(template.inputDisappearedFileFieldId).val('');
    };
    /**
     * Select files
     * @param event
     */
    input.fileChangedHandler = function (event) {
        if (isUndefined(event.target) || isUndefined(event.target.files) || input.disabled) {
            return;
        }

        var activeChat = chats.getActive();
        var files = event.target.files;
        var moreThan = false;
        var error = null;

        if (!files || Object.keys(files).length <= 0 || !activeChat || isUndefined(input.data[activeChat.identity])) {
            return;
        }

        if ([MESSAGE_TYPE_DISAPPEARING_VIDEO, MESSAGE_TYPE_DISAPPEARING_PHOTO].indexOf(input.data[activeChat.identity].messageType) >= 0) {
            input.showFileError(activeChat.identity, 'Please remove disappearing file before select private files.');
            $(template.inputFileFieldId).val('');
            return;
        }

        if (!isAvailableToSendFiles()) {
            $(template.inputFileFieldId).val('');
            return;
        }

        // if (checkFilesSelectionAvailabilityDependingOnFreeBalance()) {
        //     return;
        // }

        var time = (new Date()).getTime();
        var communicationFilesCount = input.data[activeChat.identity].communication.length;
        var maxUploadCount = CHAT_UPLOAD_MAX_FILES - communicationFilesCount;
        Object.keys(files).forEach(function (key) {
            if (moreThan) {
                return;
            }

            if (Object.keys(input.data[activeChat.identity].files).length >= maxUploadCount) {
                moreThan = true;
                error = 'You can\'t select more then ' + CHAT_UPLOAD_MAX_FILES + ' files.'
                return;
            }

            var fileKey = 'file_' + Object.keys(input.data[activeChat.identity].files).length + '_' + time,
                file = files[key],
                valid = isChatFileValid(file);

            if (valid.status) {
                input.data[activeChat.identity].files.push({
                    index: fileKey,
                    file: file,
                    type: valid.mediaType,
                    isNew: true,
                    status: FILE_STATUS_SEND
                });
            } else {
                error = ((error === null) ? valid.text : error + ' ' + valid.text);
            }
        });

        input.data[activeChat.identity].messageType = MESSAGE_TYPE_MEDIA;

        input.renderSelectedFiles();

        if (error !== null) {
            input.showFileError(activeChat.identity, error)
        }

        $(template.inputFileFieldId).val('');
    };

    /**
     * Render selected files im a view
     */
    input.renderSelectedFiles = function () {
         var activeChat = chats.getActive();
         input.clearSelectedFiles();

         if (!activeChat || input.disabled) {
             return;
         }

         if (
             isUndefined(input.data[activeChat.identity]) ||
             isUndefined(input.data[activeChat.identity].files) ||
             Object.keys(input.data[activeChat.identity].files).length <= 0
         ) {
             return;
         }

         Object.keys(input.data[activeChat.identity].files).forEach(function (key) {
             var file = input.data[activeChat.identity].files[key],
                 exist = $(template.fileSelectWrapId).find('.file-wrap[data-index="' + file.index + '"]');

             if (!exist || exist.length <= 0) {
                 var tpl = getTemplate(
                     template.fileSelectTemplate,
                     {
                         index: file.index,
                         name: (file.file.name) ? _.escape(file.file.name) : 'None',
                         identity: activeChat.identity
                     }
                 );

                 $(template.fileSelectWrapId).append(tpl);
             }
         });

         $(template.fileSelectWrapId).removeClass('hidden');
         input.resizeChatWrap();
    };

    /**
     * Clear selected files view
     */
    input.clearSelectedFiles = function() {
        $(template.fileSelectWrapId).html('');
        $(template.fileSelectWrapId).addClass('hidden');
        input.resizeChatWrap(true);
    };

    /**
     * Remove selected file from storage and view
     * @param identity
     * @param index
     */
    input.removeSelectedFiles = function (identity, index) {
        if (isUndefined(input.data[identity]) || isUndefined(input.data[identity].files) || Object.keys(input.data[identity].files).length <= 0)
            return;

        Object.keys(input.data[identity].files).forEach(function (key) {
            if (input.data[identity].files[key] && input.data[identity].files[key].index == index) {
                input.data[identity].files.splice(key, 1);
                $(template.fileSelectWrapId).find('.file-wrap[data-index="' + index + '"]').remove();
            }
        });

        if (
            Object.keys(input.data[identity].files).length <= 0 &&
            [MESSAGE_TYPE_DISAPPEARING_PHOTO, MESSAGE_TYPE_DISAPPEARING_VIDEO].indexOf(input.data[identity].messageType) >= 0
        ) {
            input.data[identity].messageType = null;
        }

        if (
            Object.keys(input.data[identity].files).length <= 0 &&
            chats.getActive() &&
            chats.getActive().identity == identity
        ) {
            input.clearSelectedFiles();
        }
    };

    /**
     * Get communication files from backend
     */
    input.selectCommunication = function () {
        if (input.disabled) {
            return;
        }

        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeProfile || !activeChat) {
            return;
        }

        if (!isAvailableToSendFiles()) {
            return;
        }

        var uid = activeProfile.inner.uid;
        var modal = $(template.modalCommunicationFiles);

        addPreloader(false, false, modal.find('.modal-content'));
        modal.find('#storage-files').html('<div class="clearfix"></div>');
        modal.find('.attach-button').removeClass('active');

        if (isResponsive() && $('#chat-page').hasClass('nav-sm')) {
            $('#chat-page').removeClass('nav-sm').addClass('nav-md');
        }
        modal.modal('show');

        input.clearCommunicationFiles();

        $.ajax({
            url: '/chats/communication/' + uid + '/',
            method: 'POST',
        }).done(function(data) {
            if (data.success) {
                if (!data.data || data.data.length <= 0) {
                    addEmpty(modal.find('#storage-files'), {text: 'There is no communication files.'})
                } else {
                    input.communicationFiles[activeChat.identity] = data.data;
                    input.renderCommunicationModal();
                }
            } else {
                addError({ code: 2, text: 'Can\'t get model communication files.'}, false, modal.find('#storage-files'));
            }

            removePreloader(false, modal.find('.modal-content'));
        }).fail(function () {
            addError({ code: 2, text: 'Can\'t get model communication files.'}, false, modal.find('#storage-files'));
            removePreloader(false, modal.find('.modal-content'));
        });
    };

    /**
     * Attach files
     */
    input.attachFiles = function () {
        var modal = $(template.modalCommunicationFiles);
        var select = modal.find('input[name="selected[]"]:checked');
        var ativeChat = chats.getActive();

        if (!select || select.length <= 0 || !ativeChat) {
            input.clearCommunicationFiles();
            modal.modal('hide');
            return;
        }

        var uids = [];

        select.each(function (index) {
            var element = $(this);
            uids[index] = parseInt(element.val());
        });

        var count = parseInt($(template.fileSelectWrapId).find('.file-wrap').length),
            error = null;
        if (!isUndefined(input.communicationFiles[ativeChat.identity]) && Object.keys(input.communicationFiles[ativeChat.identity]).length > 0) {
            Object.keys(input.communicationFiles[ativeChat.identity]).forEach(function (key) {
                var file = input.communicationFiles[ativeChat.identity][key];

                if (!file)
                    return;

                var position = uids.indexOf(file.uid);

                if (position < 0)
                    return;

                if (isUndefined(input.data[ativeChat.identity]))
                    input.data[ativeChat.identity] = {};

                if (isUndefined(input.data[ativeChat.identity].communication))
                    input.data[ativeChat.identity].communication = [];

                if (++count > CHAT_UPLOAD_MAX_FILES) {
                    error = 'You can\'t select more then ' + CHAT_UPLOAD_MAX_FILES + ' files.';
                    return;
                }

                var mediaObject = {
                    index: file.entity_id,
                    isNew: true,
                    status: FILE_STATUS_UPLOADED,
                    type: file.type,
                    file: file,
                    isStorage: true
                };

                input.data[ativeChat.identity].communication.push(mediaObject);
            });
        }

        input.setCountCommunication();
        if (error !== null) {
            input.showFileError(ativeChat.identity, error);
        }

        modal.modal('hide');
    };

    /**
     * Add counter of communication files
     */
    input.setCountCommunication = function () {
        var activeChat = chats.getActive();

        if (!activeChat || isUndefined(input.data[activeChat.identity]) || isUndefined(input.data[activeChat.identity].communication) || input.data[activeChat.identity].communication.length <= 0) {
            input.container.find('.selected-communication-files-count').text('');
            input.container.find('.selected-communication-files-count').removeClass('active');
        } else {
            input.container.find('.selected-communication-files-count').text(input.data[activeChat.identity].communication.length);
            input.container.find('.selected-communication-files-count').addClass('active');
        }
    };

    /**
     * Clear communication files object
     */
    input.clearCommunicationFiles = function () {
        var activeChat = chats.getActive();

        if (!activeChat) {
            return;
        }

        if (!isUndefined(input.data[activeChat.identity]) && !isUndefined(input.data[activeChat.identity].communication))
            input.data[activeChat.identity].communication = [];

        input.communicationFiles[activeChat.identity] = [];
        input.container.find('.selected-communication-files-count').text('');
        input.container.find('.selected-communication-files-count').removeClass('active');
    };

    /**
     * Render communication files list
     */
    input.renderCommunicationModal = function() {
        var activeChat = chats.getActive();

        if (
            !activeChat ||
            isUndefined(input.communicationFiles[activeChat.identity]) ||
            Object.keys(input.communicationFiles[activeChat.identity]).length <= 0
        ) {
            return;
        }

        var modal = $(template.modalCommunicationFiles);

        Object.keys(input.communicationFiles[activeChat.identity]).forEach(function (key) {
            var file = input.communicationFiles[activeChat.identity][key];
            var content = '';

            if (!file) {
                return;
            }

            if (file.type == TYPE_PHOTO) {
                content = getTemplate(template.communicationPhotoTemplate, file);
            } else if (file.type == TYPE_VIDEO) {
                content = getTemplate(template.communicationVideoTemplate, file);
            }

            if (content.length > 0) {
                modal.find('#storage-files').append(content);
            }
        });

        modal.find('#storage-files').append('<div class="clearfix"></div>');
        input.initVideoPlayer();
    };

    /**
     * Init vidoe player
     */
    input.initVideoPlayer = function() {
        var modal = $(template.modalCommunicationFiles),
            videos = modal.find('.video-js');

        if (videos.length > 0) {
            for (var i = 0; i < videos.length; i++) {
                videojs('#' + videos.eq(i).attr('id'), {
                    controls: true,
                    autoplay: false,
                    preload: 'auto'
                });
            }
        }
    };

    /**
     * Show file select error
     * @param identity
     * @param text
     */
    input.showFileError = function (identity, text) {
        var activeChat = chats.getActive();

        if (activeChat.identity != identity || !text) {
            return;
        }

        input.addTextFieldError(text, 3);
    };

    /**
     * Delete owner messages
     * @param sid
     */
    input.deleteMessage = function (sid) {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (
            !activeChat ||
            isUndefined(chat.data[activeChat.identity].messages) ||
            isUndefined(chat.data[activeChat.identity].messages[sid])
        ) {
            return;
        }

        var message = chat.data[activeChat.identity].messages[sid];

        for (var i = 0; i < chat.list[activeChat.identity].length; i++) {
            if (
                !isUndefined(chat.list[activeChat.identity][i]) &&
                chat.list[activeChat.identity][i].sid == message.sid
            ) {
                if (
                    !isUndefined(chat.list[activeChat.identity][i].temp) ||
                    chat.list[activeChat.identity][i].temp ||
                    chat.list[activeChat.identity][i].status == MESSAGE_DELIVERY_BROKE
                ) {
                    if (chat.list[activeChat.identity][i].type === MESSAGE_TYPE_WINK) {
                        input.checkWink();
                    }
                    input.deleteMessageFromStore(activeChat.identity, message.sid, i);
                } else {
                    var messageWrap = chat.container.find('.messages[data-sid="' + sid + '"]');
                    messageWrap.addClass('deleting');

                    socket.instance.deleteMessage(
                        activeProfile.inner.uid,
                        activeChat.identity,
                        sid,
                        function (data, error) {
                            messageWrap.removeClass('deleting');

                            if (error) {
                            chat.addError({
                                code: 1,
                                text: error.text ? error.text : 'Can\'t delete message. Please try again later.'
                            }, 5000, messageWrap);
                            return;
                        }

                            chat.updateChatMessage(data.identity, data.message);
                    });
                }

                break;
            }
        }
    };

    /**
     * Delete media file
     * @param identity
     * @param sid
     * @param messageSid
     */
    input.deleteMedia = function (identity, sid, messageSid) {
        var activeChat = chats.getActive();

        if (
            !activeChat ||
            isUndefined(chat.data[activeChat.identity].messages) ||
            isUndefined(chat.data[activeChat.identity].messages[messageSid])
        ) {
            return;
        }

        var message = chat.data[activeChat.identity].messages[messageSid];

        for (var i = 0; i < chat.list[activeChat.identity].length; i++) {
            if (!isUndefined(chat.list[activeChat.identity][i]) && chat.list[activeChat.identity][i].sid == message.sid) {
                if (chat.list[activeChat.identity][i].media && Object.keys(chat.list[activeChat.identity][i].media).length > 0) {
                    Object.keys(chat.list[activeChat.identity][i].media).forEach(function (key) {
                        if (chat.list[activeChat.identity][i].media[key]) {
                            var media = chat.list[activeChat.identity][i].media[key];

                            if (media.isNew && media.index == sid) {
                                chat.list[activeChat.identity][i].media.splice(key, 1);
                                chat.container.find('.messages[data-sid="' + messageSid + '"]').find('.message-user__files[data-sid="' + media.index + '"]').remove();

                                if (
                                    isUndefined(chat.list[activeChat.identity][i].media) ||
                                    Object.keys(chat.list[activeChat.identity][i].media).length <= 0 &&
                                    chat.list[activeChat.identity][i].body.length <= 0
                                ) {
                                    input.deleteMessage(messageSid);
                                } else {
                                    chat.updateMessageStatus(chat.list[activeChat.identity][i]);
                                }
                            } else if (!media.isNew && media.sid == sid) {
                                socket.instance.deleteMessageMedia(
                                    profiles.getActive().inner.uid,
                                    activeChat.identity,
                                    messageSid,
                                    sid,
                                    function (data, error) {
                                        var messageWrap = chat.container.find('.messages[data-sid="' + messageSid + '"]');

                                        if (error) {
                                        addErrorAlert(error.text ? error.text : 'Can\'t delete file.', 3000, messageWrap);
                                        return;
                                    }

                                        chat.list[activeChat.identity][i].media[key].status = FILE_STATUS_DELETED;

                                        if (
                                            isUndefined(chat.list[activeChat.identity][i].media) ||
                                            Object.keys(chat.list[activeChat.identity][i].media).length <= 0 &&
                                            chat.list[activeChat.identity][i].body.length <= 0
                                        ) {
                                            input.deleteMessage(messageSid);
                                        }
                                });
                            }
                        }
                    });
                }
            }
        }

        if (!isUndefined(media.data[identity]) && !isUndefined(media.data[identity][sid])) {
            media.data[identity][sid].status = FILE_STATUS_DELETED;
        }
    };

    chat.reSendActionStatus = function (message) {
        var wrap = this.container.find('.messages[data-sid="' + message.sid + '"]');

        if (!wrap || wrap.length <= 0)
            return;

        if (
            message.status != MESSAGE_DELIVERY_BROKE ||
            (
                message.status === MESSAGE_DELIVERY_BROKE &&
                message.type === MESSAGE_TYPE_WINK
            )
        ) {
            wrap.find('.message-action-wrap').find('.resend').addClass('hidden');
            wrap.find('.message-action-wrap').find('.resend-media').addClass('hidden');
            return;
        }

        if (
            [MESSAGE_TYPE_MEDIA, MESSAGE_TYPE_DISAPPEARING_PHOTO, MESSAGE_TYPE_DISAPPEARING_VIDEO]
                .indexOf(message.type) >= 0
        ) {
            var hasBrokenMedia = false;

            if (message.media && Object.keys(message.media).length > 0) {
                Object.keys(message.media).forEach(function (key) {
                    if (isUndefined(message.media[key]))
                        return;

                    if (message.media[key].status != FILE_STATUS_UPLOADED)
                        hasBrokenMedia = true;
                })
            }

            if (hasBrokenMedia === false && message.body.length <= 0) {
                wrap.find('.message-action-wrap').find('.resend-media').removeClass('hidden');
            } else if (hasBrokenMedia === false && message.body.length > 0) {
                wrap.find('.message-action-wrap').find('.resend').removeClass('hidden');
            }
        } else {
            wrap.find('.message-action-wrap').find('.resend').removeClass('hidden');
        }
    };

    /**
     * Delete message from storage and view
     * @param identity
     * @param sid
     * @param key
     * @param deletedMessage
     */
    input.deleteMessageFromStore = function (identity, sid, key, deletedMessage) {
        if (!chat.data || isUndefined(chat.data[identity]) || isUndefined(chat.data[identity].messages[sid]))
            return;

        var message = chat.data[identity].messages[sid],
            wrap = chat.container.find('.messages[data-sid="' + sid + '"]');
        if (!isUndefined(key) && !isUndefined(chat.list[identity][key]) && chat.list[identity][key].sid == message.sid) {
            chat.list[identity].splice(key, 1);
            delete chat.data[identity].messages[sid];

            if (wrap && wrap.length > 0)
                wrap.remove();

            return;
        }

        for (var i = 0;i < chat.list[identity].length;i++) {
            if (!isUndefined(chat.list[identity][i]) && chat.list[identity][i].sid == message.sid) {
                if (key) {
                    chat.list[identity].splice(key, 1);
                    delete chat.data[identity].messages[sid];

                    if (wrap && wrap.length > 0)
                        wrap.remove();
                } else if (!key && deletedMessage) {
                    chat.list[identity][i] = deletedMessage;
                    chat.addOrUpdateMessage(identity, deletedMessage);
                }

                break;
            }
        }
    };

    /**
     * Resend data to chat
     * @param sid
     */
    input.reSendMessage = function (sid) {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (
            !activeChat ||
            isUndefined(chat.data[activeChat.identity].messages) ||
            isUndefined(chat.data[activeChat.identity].messages[sid])
        ) {
            return;
        }

        var messages = chat.list[activeChat.identity];
        var message = null;
        var chatKey = null;

        if (!messages || Object.keys(messages).length <= 0) {
            return;
        }

        Object.keys(messages).forEach(function (key) {
            if (messages[key].sid == sid) {
                message = messages[key];
                chatKey = key;
            }
        });

        if (!message || isUndefined(message.temp) || !message.temp) {
            return;
        }

        input.deleteMessageFromStore(activeChat.identity, sid, chatKey);

        var author = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;
        var opponent = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;

        var messageBody = getMessageBody(message).replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        var media = message.media;
        var tempKey = message.key;
        var tmpMessage = input.getTempMessageModel(
            activeChat.identity,
            author,
            opponent,
            message.type,
            messageBody,
            media,
            null,
            message.gift,
            message.sticker,
            tempKey
        );

        chat.setChatMessages(activeChat.identity, [tmpMessage], true);
        input.clearTextField();
        chat.scrollAfterNewMessageReceived();

        socket.instance.sendNewMessage(
            activeProfile.inner.uid,
            activeChat.identity,
            tmpMessage.type,
            messageBody,
            media,
            tmpMessage.gift ? {
                uid: tmpMessage.gift.uid,
                title: tmpMessage.gift.title,
                body: tmpMessage.gift.body,
            } : null,
            tmpMessage.sticker,
            tempKey,
            function (error, ownerUid, identity) {
                if (error) {
                    tmpMessage.status = MESSAGE_DELIVERY_BROKE;

                    if (chats.getActive() && chats.getActive().identity == identity) {
                        input.addTextFieldError(
                            (error.message) ?
                                error.message :
                                'Can\'t send message please try again',
                            2
                        );
                    }

                    chat.setChatMessages(identity, [tmpMessage]);
                }
            }
        );
    };

    /**
     * Get new message model
     * @param identity
     * @param author
     * @param opponent
     * @param type
     * @param message
     * @param media
     * @param communicationMedia
     * @param gift
     * @param sticker
     * @param tempKey
     * @returns {{author: *, created: number, channel: *, index: number, memberStatus: {}, media: Array, body: *, type: number, updated: number, key: *, sid: *, status: number}|{}}
     */
    input.getTempMessageModel = function (
        identity,
        author,
        opponent,
        type,
        message,
        media,
        communicationMedia,
        gift,
        sticker,
        tempKey
    ) {
        if (isUndefined(chats.list[identity]))
            return {};

        var channel = chats.list[identity],
            time = (new Date()).getTime();

        if (!media)
            media = [];

        if (communicationMedia && Object.keys(communicationMedia).length > 0)
            media = media.concat(communicationMedia);

        return {
            key: tempKey,
            author: author,
            index: (channel.index) ? channel.index + 1 : 0,
            body: message ? message : '',
            type: type,
            channel: channel,
            created: time,
            updated: time,
            memberStatus: {
                [opponent.uid]: {
                    uid: opponent.uid,
                    status: MESSAGE_STATUS_UNREAD,
                    readAt: null
                }
            },
            media: (media && Object.keys(media).length > 0) ? media : [],
            sid: tempKey,
            status: MESSAGE_DELIVERY_SEND,
            temp: true,
            gift: gift ? {
                uid: gift.uid,
                actionType: gift.actionType,
                status: gift.status,
                src: gift.src,
                title: gift.title,
                body: gift.body,
                price: gift.price,
            } : null,
            sticker: sticker ? { uid : sticker.uid } : null
        };
    };

    /**
     * Add input error message
     *
     * @param message
     * @param timeout
     */
    input.addTextFieldError = function (message, timeout) {
        input.clearTextFieldError();

        this.container.addClass('error');

        if (message) {
            this.container.append(getTemplate(templates.inputErrorTemplate, { message: message }));
        }

        input.resizeChatWrap();
        if (timeout)
            setTimeout(function () {
                input.clearTextFieldError();
                input.resizeChatWrap();
            }, timeout * 1000)
    };

    /**
     * Remove error for text input
     */
    input.clearTextFieldError = function () {
        input.container.removeClass('error');
        input.container.find('.input-text-error').remove();
    };

    /**
     * Resize input wrap after bacspace
     * @param notScroll
     */
    input.resizeChatWrap = function (notScroll) {
        var inputHeight = input.container[0].clientHeight,
            titleHeight = 0,//chat.titleContainer[0].clientHeight,
            parentHeight =  input.container.parent()[0].clientHeight - 10;

        var height = parentHeight - (inputHeight + titleHeight);
        chat.container.height(height);

        if (!notScroll)
            chat.scrollAfterNewMessageReceived();
    };

    /**
     * Check virtual gift after chnage channel or received new message from opponent
     * @param messageReceived
     */
    input.checkVirtualGift = function (messageReceived) {
        if (!chats.getActive() || !chats.getActive().members || chats.getActive().members.length < 2) {
            return;
        }

        var profileUid, userUid, userName;

        chats.getActive().members.forEach(function (member) {
            if (profiles.getActive().outer[member.uid]) {
                profileUid = member.uid;
            } else {
                userUid = member.uid;
                userName = member.first_name;
            }
        });

        document.dispatchEvent(
            new CustomEvent(
                messageReceived ? 'receivedMessage' : 'changeChannel', {
                    detail: {
                        profileUid: profileUid,
                        userUid: userUid,
                        userName: userName
                    }
                }
            )
        );
    };

    input.setStickerMessageAnimation = function (text) {
        document.dispatchEvent(
            new CustomEvent(
                'stickerAddMessageAnimation',
            )
        );
    };

    input.checkSticker = function () {
        var activeChat = chats.getActive();

        if (!activeChat || !activeChat.members || activeChat.members.length < 2) {
            return;
        }

        var params = {
            importUid: null,
            profileUid: null,
            userUid: null,
            identity: activeChat.identity
        };

        activeChat.members.forEach(function (member) {
            if (profiles.getActive().outer[member.uid]) {
                params.profileUid = member.uid;
                params.importUid = member.import_uid;
            } else {
                params.userUid = member.uid;
            }
        });

        document.dispatchEvent(
            new CustomEvent(
                'stickerChangeChannel',
                {
                    detail: params
                }
            )
        );

        socket.instance.isStickerAvailable(params, function (response) {
            if (!chats.getActive() || activeChat.identity !== chats.getActive().identity) {
                return;
            }

            input.toggleStickerStatus(activeChat.identity, !!response);
        });
    };

    input.toggleStickerStatus = function (identity, active) {
        document.dispatchEvent(
            new CustomEvent(
                'stickerChangeBtnStatus',
                {
                    detail: {
                        identity: identity,
                        status: active,
                    }
                }
            )
        );
    }

    input.checkWink = function () {
        var activeChat = chats.getActive();

        if (!activeChat || !activeChat.members || activeChat.members.length < 2) {
            return;
        }

        var params = {
            profile_uid: null,
            user_uid: null
        };

        activeChat.members.forEach(function (member) {
            if (profiles.getActive().outer[member.uid]) {
                params.profile_uid = member.uid;
            } else {
                params.user_uid = member.uid;
            }
        });

        sendApiRequest(
            urls.winkAvailable,
            null,
            params,
            function (response, errors) {
                if (!chats.getActive() || activeChat.identity !== chats.getActive().identity) {
                    return;
                }

                if (errors || !response || !response.success) {
                    return;
                }

                if (parseInt(response.data) === WINK_AVAILABLE) {
                    input.showWinkButton(activeChat);
                } else {
                    input.removeWinkButton();
                }
            },
            'GET',
            {
                token: activityToken
            }
        );
    };

    input.showWinkButton = function (activeChat) {
        var buttonIntrval = setInterval(function () {
            var emojionearea = $('.emojionearea');

            if (!chats.getActive() || activeChat.identity !== chats.getActive().identity) {
                clearInterval(buttonIntrval);
                return;
            }

            if (emojionearea.length !== 0) {
                clearInterval(buttonIntrval);
                var tmp = getTemplate('#template_wink-button', {});
                emojionearea.append(tmp);
                $('.emojionearea-editor').addClass('wink-available');
            }
        }, 500);
    };

    input.removeWinkButton = function () {
        $('.wink-btn').remove();
        $('.emojionearea-editor').removeClass('wink-available');
    };

    input.sendWink = function () {
        if (input.disabled) {
            input.addTextFieldError('Can\'t send gift now. Please try again after few seconds.', 2);
            return;
        }

        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile || !activeChat.members || activeChat.members.length < 2) {
            return;
        }

        input.removeWinkButton();
        removeEmpty(chats.container);

        var tempKey = socket.instance.getMessageTempKey(activeChat.identity);
        var params = {
            profile_uid: null,
            user_uid: null,
            key: tempKey
        };

        activeChat.members.forEach(function (member) {
            if (profiles.getActive().outer[member.uid]) {
                params.profile_uid = member.uid;
            } else {
                params.user_uid = member.uid;
            }
        });

        var author = chats.data[activeProfile.inner.uid][activeChat.identity].modelProfile;
        var opponent = chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;

        var tmpMessage = input.getTempMessageModel(
                activeChat.identity,
                author,
                opponent,
                MESSAGE_TYPE_WINK,
                null,
                null,
                null,
                null,
                null,
                tempKey
            );

        chat.setChatMessages(activeChat.identity, [tmpMessage], true);
        chat.scrollAfterNewMessageReceived();

        sendApiRequest(
            urls.addWink,
            null,
            JSON.stringify(params),
            function (response, errors) {
                if (errors || !response || !response.success) {
                    chat.messageDeliveryError(
                        {identity: activeChat.identity},
                        tmpMessage,
                        {text: errors && errors.responseJSON && errors.responseJSON.errors ?
                                errors.responseJSON.errors :
                                'Can\'t send wink. Please try again later or contact with support.'
                        }
                    );
                    return;
                }
            },
            'POST',
            {
                token: activityToken,
                ContentType: 'application/json'
            },
            'json'
        );
    };

    /**
     * Try to receive active data
     */
    info.getActiveUserData = function () {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        info.container.html('');

        if (!activeProfile || !activeChat) {
            return;
        }

        if (
            isUndefined(chats.data[activeProfile.inner.uid]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile)
        ) {
            return;
        }

        info.setUserData(chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile, activeChat.identity);
    };

    info.setUserData = function (user, identity) {
        info.container.html('');

        if (!chats.getActive() || !user) {
            return;
        }

        info.addPreloader();

        if (isUndefined(info.data[user.uid])) {
            updateUserActiveDataByUid(
                user.uid,
                function (data) {
                    if (data.success) {
                        info.data[user.uid] = data.data;
                        info.renderInfoWrap(identity, data.data);
                    } else {
                        info.data[user.uid] = null;
                        if (chats.getActive() && identity === chats.getActive().identity) {
                            info.addError({ code: 2, text: 'Can\'t get user profile.'});
                        }
                    }

                    info.removePreloader();
                },
                function () {
                    info.data[user.uid] = null;

                    if (chats.getActive() && identity === chats.getActive().identity) {
                        info.addError({ code: 2, text: 'Can\'t get user profile.'});
                    }

                    info.removePreloader();
                }
            );
        } else {
            info.renderInfoWrap(identity, info.data[user.uid]);
            info.removePreloader();
        }
    };

    /**
     * Get user comments
     *
     * @param more
     */
    comments.getActiveUserComments = function (more) {
        var activeChat = chats.getActive();

        if (!activeChat) {
            return;
        }

        comments.active.identity = activeChat.identity;

        if (!isUndefined(comments.data[activeChat.identity])) {
            if (comments.data[activeChat.identity].send) {
                return;
            }

            if (!isUndefined(comments.data[activeChat.identity].token) && parseInt(comments.data[activeChat.identity].token) <= 0) {
                comments.renderComments();
                return;
            }
        }

        if (!more && !isUndefined(comments.data[activeChat.identity])) {
            comments.renderComments();
            comments.addLoadMore();
            return;
        }

        var queryParams = comments.getRequireQueryParams();
        if (!queryParams) {
            return addErrorAlert('Can\'t get user comments.', false, this.container);
        }

        if (more) {
            comments.hideLoadMore();
        }

        this.addPreloader(more);

        var identity = comments.active.identity;

        if (isUndefined(comments.data[identity])) {
            comments.data[identity] = {};
        }

        comments.data[identity].send = true;

        var query = {
            created_by: queryParams.modelId,
            user_id: queryParams.userId
        };

        if (comments.data[identity].token && parseInt(comments.data[identity].token) > 0) {
            query.token = comments.data[identity].token;
        }

        sendApiRequest(
            urls.commentGet,
            queryParams.projectId,
            query,
            function (data, error) {
                comments.removePreloader(more);

                if (!error) {
                    if (data.success && data.data) {
                        if (isUndefined(comments.data[identity])) {
                            comments.data[identity] = {};
                        }

                        comments.data[identity].token = (isUndefined(data.data.token)) ? null : data.data.token;

                        if (isUndefined(comments.data[identity].items)) {
                            comments.data[identity].items = [];
                        }

                        if (!isUndefined(data.data.items) && data.data.items.length > 0) {
                            for (var i = 0; i < data.data.items.length; i++) {
                                comments.data[identity].items.push(data.data.items[i]);
                            }
                        }

                        if (comments.active.identity === identity) {
                            comments.renderComments();
                            comments.showCommentForm();
                        }

                        comments.addLoadMore();
                        comments.data[identity].send = false;
                        return;
                    }
                }

                comments.data[identity].send = false;
                return addErrorAlert('Can\'t get user comments.', false, comments.container);
            }
        );
    };

    /**
     * Render comments
     */
    comments.renderComments = function () {
        if (!comments.active.identity) {
            return;
        }

        removeEmpty(comments.container);

        if (
            isUndefined(comments.data[comments.active.identity].items) ||
            comments.data[comments.active.identity].items.length <= 0
        ) {
            return addEmpty(comments.container, {text: 'There is no comments.'});
        }

        var commentMessages = comments.data[comments.active.identity].items;

        commentMessages.sort(function (a, b) {
            return b.created_at - a.created_at;
        });

        for (var i = 0; i < commentMessages.length; i++) {
            var tpl = comments.renderComment(commentMessages[i]);
            var comment = comments.getCommentView(commentMessages[i].uid);

            if (comment) {
                comment.replaceWith(tpl);
            } else {
                this.container.append(tpl);
            }
        }
    };

    /**
     * Comment already exist
     *
     * @param uid
     * @returns {*|boolean}
     */
    comments.getCommentView = function (uid) {
        var comment = this.container.find('.comments-message-wrap[data-uid="' + uid + '"]');

        return (comment && comment.length > 0) ? comment : null;
    };
    /**
     * Show new commwnt form
     */
    comments.showCommentForm = function () {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeProfile || !activeChat) {
            return;
        }

        comments.hideCommentForm();

        var tmp = getTemplate(
            template.commentsNewFormTemplate,
            {
                userId: chats.getActiveChatUserId(),
                createdBy: chats.getActiveChatModelProfileId()
            });

        this.container.parents(template.commentsFormMessageWrap).eq(0).prepend(tmp);
    };

    /**
     * Remove new comment form
     */
    comments.hideCommentForm = function () {
        this.container.parent().find(template.commentsNewFormWrap).remove();
        this.container.attr('style', '');
    };

    /**
     * Clear comment form
     */
    comments.clearCommentForm = function () {
        this.container.parent().find(template.commentsNewFormWrap).find('textarea').val('');
    };

    /**
     * Add new comment
     *
     * @param event
     */
    comments.addNewComment = function (event) {
        event.preventDefault();

        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeProfile || !activeChat) {
            return;
        }

        var form = $(event.target);

        if (!comments.validateCommentForm(form)) {
            return;
        }

        var queryParams = comments.getRequireQueryParams();

        if (!queryParams) {
            return;
        }

        addPreloader(false, false, form);

        var identity = comments.active.identity;

        sendApiRequest(
            urls.commentCreate,
            queryParams.projectId,
            form.serialize(),
            function (data, error) {
                removePreloader(false, form);

                if (error) {
                    form.addClass('has-error');
                    var message = null;

                    if (error.status == API_RESPONSE_STATUS_NOT_VALID_DATA) {
                        message = getApiErrorsAsString(error, ['text', 'created_by']);
                    }

                    alertError((message) ? message : 'Can\'t add new comment. Please try again later.');
                    return;
                }

                if (data.success && data.data) {
                    var tmp = comments.renderComment(data.data);
                    comments.container.prepend(tmp);
                    comments.removePreloader();
                    comments.showCommentForm();
                    removeEmpty(comments.container);
                    removeErrorAlert(comments.container);

                    if (isUndefined(comments.data[identity])) {
                        comments.data[identity] = {};
                    }

                    if (isUndefined(comments.data[identity].items)) {
                        comments.data[identity].items = [];
                    }

                    comments.data[identity].identity = identity;
                    comments.data[identity].items.push(data.data);

                    var comment = comments.getCommentView(data.data.uid);

                    if (comment) {
                        scrollToView(comment);
                    }

                    return;
                }

                alertError((message) ? message : 'Can\'t add new comment. Please try again later.');
                return;
            },
            'POST'
        );
    };

    /**
     * Validate comment text
     *
     * @param form
     * @returns {boolean}
     */
    comments.validateCommentForm = function (form) {
        var textarea = form.find('textarea');

        if (!textarea || textarea.length <= 0) {
            alertError('Not valid data set for comment.');
            return false;
        }

        var value = textarea.val();

        if (value.length <= 0) {
            alertError('Comment text can\'t be empty.');
            textarea.parent().addClass('has-error');
            return false;
        }

        if (value.length > 255) {
            alertError('Comment text can\'t be more than 255 characters');
            textarea.parent().addClass('has-error');
            return false;
        }

        return true;
    };

    /**
     * Render message
     *
     * @param data
     */
    comments.renderComment = function (data) {
        return getTemplate(
            template.commentsMessageTemplate,
            {
                time: getDateFromTimestamp(data.created_at),
                uid: data.uid,
                text: data.text
            }
        );
    };

    /**
     * Add load more button
     */
    comments.addLoadMore = function () {
        comments.hideLoadMore();

        if (!comments.active.identity) {
            return;
        }

        var token = (!isUndefined(comments.data[comments.active.identity]) &&
            !isUndefined(comments.data[comments.active.identity].token)) ?
            comments.data[comments.active.identity].token :
            0;

        if (parseInt(token) <= 0) {
            return;
        }

        this.container.append(getTemplate(template.commentsMessageLoadMoreTemplate, {}));
    };

    /**
     * Add load more button for media
     */
    profileMedia.addLoadMore = function () {
        profileMedia.hideLoadMore();

        if (!profileMedia.active.uid) {
            return;
        }

        var token = (!isUndefined(profileMedia.data[profileMedia.active.uid]) && !isUndefined(profileMedia.data[profileMedia.active.uid].token))
            ? profileMedia.data[profileMedia.active.uid].token : 0;

        if (parseInt(token) <= 0) {
            return;
        }

        this.container.append(getTemplate(template.mediaMessageLoadMoreTemplate, {}));
    };

    /**
     * Remove load more button
     */
    comments.hideLoadMore = function () {
        this.container.find('.load-more-message').remove();
    };

    /**
     * Remove load more button
     */
    profileMedia.hideLoadMore = function () {
        this.container.find('.load-more-profile-media').parent().remove();
    };

    /**
     * Delete comment
     *
     * @param uid
     */
    comments.deleteComment = function (uid) {
        if (!uid) {
            return;
        }

        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeProfile || !activeChat) {
            return;
        }

        var queryParams = comments.getRequireQueryParams();
        var comment = comments.getCommentView(uid);

        if (!queryParams) {
            return alertError('Can\'t delete comment.');
        }


        comments.addPreloader(true, false, comment);

        var identity = comments.active.identity;

        if (isUndefined(comments.data[identity])) {
            comments.data[identity] = {};
        }

        sendApiRequest(
            urls.commentDelete,
            queryParams.projectId,
            {
                created_by: queryParams.modelId,
                user_id: queryParams.userId,
                uid: uid
            },
            function (data, error) {
                comments.removePreloader(true, comment);

                if (error) {
                    return alertError('Can\'t delete comment.');
                }


                if (data.success && data.data) {
                    var comment = comments.getCommentView(uid);

                    if (comment) {
                        comment.remove();
                    }

                    if (!isUndefined(comments.data[identity]) && !isUndefined(comments.data[identity].items)) {
                        for (var i = 0; i < comments.data[identity].items.length; i++) {
                            if (comments.data[identity].items[i] && comments.data[identity].items[i].uid == uid) {
                                comments.data[identity].items.splice(i, 1);
                            }
                        }

                        if (comments.data[identity].items.length <= 0) {
                            addEmpty(comments.container, {text: 'There is no comments.'});
                        }
                    }

                    return;
                }

                return addErrorAlert('Can\'t delete comment.');
            },
            'POST'
        );
    };

    /**
     * Get query params from comment request
     *
     * @returns {null|{modelId: *, projectId: *, userId: *}}
     */
    comments.getRequireQueryParams = function () {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeProfile || !activeChat) {
            return null;
        }

        var modelId = chats.getActiveChatModelProfileId();
        var userId = chats.getActiveChatUserId();

        if (!modelId || !userId) {
            return null;
        }


        var projectId = null;

        if (!isUndefined(activeProfile.outer[modelId]) && !isUndefined(activeProfile.outer[modelId].project_id)) {
            projectId = activeProfile.outer[modelId].project_id;
        }

        if (!projectId) {
            return null;
        }

        return {
            projectId: projectId,
            modelId: modelId,
            userId: userId
        };
    };

    /**
     * Get api errors as text
     *
     * @param error
     * @param allowedFields
     * @returns {string}
     */
    function getApiErrorsAsString(error, allowedFields) {
        if (isUndefined(error.responseJSON) || isUndefined(error.responseJSON.errors))
            return;

        var errors = error.responseJSON.errors;

        if (!errors || errors.length <= 0)
            return;

        var messageText = '';

        for (var i = 0;i < errors.length;i++) {
            var name = errors[i].name,
                message = errors[i].message;

            if (allowedFields && allowedFields.indexOf(name) < 0)
                continue;

            if (message.length > 0)
                messageText += ' ';

            messageText += message;
        }

        return messageText;
    }

    /**
     * Clear wrap
     */
    function clear () {
        this.container.html('');
    }

    /**
     * Add data to view
     * @param identity
     * @param data
     */
    info.renderInfoWrap = function (identity, data) {
        if (!chats.getActive() || identity !== chats.getActive().identity || !data) {
            return;
        }

        var lastActivityTime = '--';

        if (!isUndefined(data.last_activity)) {
            var dateActivity = new Date();
            dateActivity.setTime(data.last_activity * 1000);

            lastActivityTime = dateActivity.getFullYear() + '-';
            lastActivityTime += (((dateActivity.getMonth() + 1) < 10) ? '0' + (dateActivity.getMonth() + 1) : (dateActivity.getMonth() + 1)) + '-';
            lastActivityTime += ((dateActivity.getDate() < 10) ? '0' + dateActivity.getDate() : dateActivity.getDate());
            lastActivityTime += ' ' + ((dateActivity.getHours() < 10) ? '0' + dateActivity.getHours() : dateActivity.getHours());
            lastActivityTime += ':' + ((dateActivity.getMinutes() < 10) ? '0' + dateActivity.getMinutes() : dateActivity.getMinutes());
        }

        info.container.html(getTemplate(template.infoWrapTemplate, {
            uid: data.uid,
            purchase_type: (data.purchase_type === PURCHASE_TYPE_PAYED) ? 'Payed' : 'Free',
            balance: data.balance,
            thumbnail: getProfileThumbnail(data),
            username: (isUndefined(data.first_name)) ? '--' : _.escape(data.first_name),
            location: (isUndefined(data.location)) ? '--' : _.escape(data.location),
            gender: (isUndefined(data.gender)) ? '--' : _.escape((data.gender == GENDER_MALE) ? 'Male' : 'Female'),
            age: (isUndefined(data.age)) ? '--' : _.escape(data.age),
            birthday: (isUndefined(data.birthday)) ? '--' : _.escape(data.birthday),

            height: (isUndefined(data.height) || isUndefined(info.property.height[data.height])) ? '--' : _.escape(info.property.height[data.height]),
            weight: (isUndefined(data.weight) || isUndefined(info.property.weight[data.weight])) ? '--' : _.escape(info.property.weight[data.weight]),
            body_type: (isUndefined(data.body_type) || isUndefined(info.property.body_type[data.body_type])) ? '--' : _.escape(info.property.body_type[data.body_type]),
            marital_status: (isUndefined(data.marital_status) || isUndefined(info.property.marital_status[data.marital_status])) ? '--' : _.escape(info.property.marital_status[data.marital_status]),
            children: (isUndefined(data.children) || isUndefined(info.property.children[data.children])) ? '--' : _.escape(info.property.children[data.children]),
            education_level:
                (isUndefined(data.education_level) || isUndefined(info.property.education_level[data.education_level]))
                    ? '--'
                    : _.escape(info.property.education_level[data.education_level]),
            religion: (isUndefined(data.religion) || isUndefined(info.property.religion[data.religion])) ? '--' : _.escape(info.property.religion[data.religion]),
            drink: (isUndefined(data.drink) || isUndefined(info.property.drink[data.drink])) ? '--' : _.escape(info.property.drink[data.drink]),
            smoke: (isUndefined(data.smoke) || isUndefined(info.property.smoke[data.smoke])) ? '--' : _.escape(info.property.smoke[data.smoke]),

            occupation: (isUndefined(data.occupation)) ? '--' : _.escape(data.occupation),
            gift_enabled: data.gift_enabled && data.gift_enabled_profile ? 'On' : 'Off',
            bio: (isUndefined(data.bio)) ? '--' : _.escape(data.bio),
            reg_country: (isUndefined(data.reg_country)) ? '--' : _.escape(data.reg_country),
            city_name: (isUndefined(data.city_name)) ? '--' : _.escape(data.city_name),
            last_activity: lastActivityTime,
            verified: (data.verified === USER_VERIFIED) ? 'Trusted' : 'Not trusted',
            prefer_gender: (isUndefined(data.prefer_gender)) ? '--' : _.escape(getPreferGender(data.prefer_gender)),
            userInterests: (isUndefined(data.userInterests)) ? '--' : getUserInterests(data.userInterests),
        }));
    };

    /**
     * Open video player popup
     * @param sid
     * @param src
     */
    input.playVideo = playVideo;
    profileMedia.playProfileVideo = playVideo;

    profileMedia.getActiveUserMedia = function (more) {
        var member = getActiveMemberProfile();

        if (!member) {
            return;
        }

        profileMedia.active.uid = member.uid;
        if (!isUndefined(profileMedia[member.uid])) {
            if (profileMedia[member.uid].send) {
                return;
            }

            if (!isUndefined(profileMedia[member.uid].token) && parseInt(profileMedia[member.uid].token) <= 0) {
                profileMedia.renderProfileMedia();
                return;
            }
        }

        if (!more && !isUndefined(profileMedia.data[member.uid])) {
            profileMedia.renderProfileMedia();
            profileMedia.addLoadMore();
            return;
        }

        profileMedia.hideLoadMore();

        this.addPreloader(more);

        if (isUndefined(profileMedia.data[member.uid])) {
            profileMedia.data[member.uid] = {};
        }

        profileMedia.data[member.uid].send = true;

        var query = {
            user_uid: member.uid
        };
        var queryParams = comments.getRequireQueryParams();

        if (profileMedia.data[member.uid].token && parseInt(profileMedia.data[member.uid].token) > 0) {
            query.token = profileMedia.data[member.uid].token;
        }

        sendApiRequest(
            urls.profileMediaGet,
            queryParams.projectId,
            query,
            function (data, error) {
                profileMedia.removePreloader(more);
                if (!error) {
                    if (data.success && data.data) {
                        profileMedia.data[member.uid].token = (isUndefined(data.data.token)) ? null : data.data.token;

                        if (isUndefined(profileMedia.data[member.uid].items)) {
                            profileMedia.data[member.uid].items = [];
                        }

                        if (!isUndefined(data.data.items) && data.data.items.length > 0) {
                            for (var i = 0; i < data.data.items.length; i++) {
                                profileMedia.data[member.uid].items.push(data.data.items[i]);
                            }
                        }

                        if (profileMedia.active.uid === member.uid) {
                            profileMedia.renderProfileMedia();
                        }

                            profileMedia.addLoadMore();
                            profileMedia.data[member.uid].send = false;
                            return;
                    }
                }

                profileMedia.data[member.uid].send = false;
                return addErrorAlert('Can\'t get user photo/video files.', false, profileMedia.container);
            }
        );
    };

    profileMedia.renderProfileMedia = function () {
        var member = getActiveMemberProfile();

        if (!member || !profileMedia.data[member.uid].items || profileMedia.data[member.uid].items <= 0) {
            this.container.html('');
            addEmpty(profileMedia.container, {text: 'User doesn\'t have photo/video.'});
            return;
        }

        var items = profileMedia.data[member.uid].items;

        for (var i = 0; i < items.length; i++) {
            var tpl = getTemplate(
                (items[i].type == TYPE_VIDEO)
                    ? template.profileMediaVideoTemplate
                    : template.profileMediaPhotoTemplate,
                {
                    src: getPhotoUrl(items[i].src),
                    placeholder: items[i].placeholder,
                    thumbnail: getPhotoUrl(items[i].thumbnail),
                    uid: items[i].uid,
                    profileUid: member.uid
                }
            );

            var itemWrap = this.container.find(`.profile-media-wrap[data-uid=${items[i].uid}]`);

            if (itemWrap.length) {
                itemWrap.replaceWith(tpl);
            } else {
                this.container.append(tpl);
            }
        }
    };

    /**
     * Get prefer gender label
     * @param prefer_gender
     * @returns {string}
     */
    function getPreferGender(prefer_gender) {
        switch (prefer_gender) {
            case PREFER_GENDER_MALE:
                return 'Men';
            case PREFER_GENDER_FEMALE:
                return 'Women';
            case PREFER_GENDER_BOTH:
                return 'Everyone';
            default:
                return '--';
        }
    }

    /**
     * Get model profile from channel
     * @param chat
     * @param importUid
     * @returns {*}
     */
    function getModelProfileFromChannel(chat, importUid) {
        if (isUndefined(chat.members) && chat.members.length <= 0) {
            return null;
        }


        var result = null;

        Object.keys(chat.members).forEach(function (key) {
            var member = chat.members[key];

            if (
                importUid == member.import_uid &&
                !isUndefined(profiles.data[importUid]) &&
                !isUndefined(profiles.data[importUid].outer[member.uid])
            ) {
                result = member;
            }
        });

        return result;
    }

    /**
     * Get model profile from channel
     * @param chat
     * @param importUid
     * @returns {*}
     */
    function getOpponentProfileFromChannel(chat, importUid) {
        if (isUndefined(chat.members) && chat.members.length <= 0)
            return null;

        var result = null;

        Object.keys(chat.members).forEach(function(key) {
            var member = chat.members[key];

            if (importUid != member.import_uid) {
                result = member;
            }
        });

        return result;
    }

    /**
     * Get formated message body
     * @param message
     * @param isOwner
     * @returns {*|string}
     */
    function getMessageContent(message, isOwner) {
        var body = '';

        switch (message.type) {
            case MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST:
            case MESSAGE_TYPE_VIRTUAL_GIFT:
                var giftTitle = message.gift.titleOrigin ?
                    _.escape(message.gift.titleOrigin) :
                    _.escape(message.gift.title ? message.gift.title : '');
                var giftBody = _.escape(
                    message.gift.bodyOrigin ?
                        message.gift.bodyOrigin  :
                        message.gift.body ?
                            message.gift.body :
                            ''
                );

                body = getTemplate(
                    template.messageGiftBodyTemplate,
                    {
                        icon: '/virtual-gift/s/' + message.gift.src,
                        price: message.gift.price ? message.gift.price : 0,
                        title: giftTitle,
                        body: giftBody,
                        openStatusClass: message.type !== MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST &&
                            message.gift.status === GIFT_STATUS_OPENED ?
                            'vg-opened' :
                            '',
                        classEmptyContent: giftBody.length === 0 &&giftTitle.length === 0 ?
                            'gift-empty-content' :
                            ''
                    }
                );
                break;
            case MESSAGE_TYPE_WINK:
                body = '<span class="chat-member__wink">\n' +
                    '                    <img src="/images/wink_chat.svg" alt=""/>\n' +
                    '                </span>';
                break;
            case MESSAGE_TYPE_MEDIA:
                var text = getMessageBody(message);
                body = emojione.toImage(_.escape(text)).replace(/([^>])\n/g, '$1<br/>');
                break;
            case MESSAGE_TYPE_DISAPPEARING_VIDEO:
                body = isDisappearingMessageExpired(message) ?
                    '<i class="fa fa-video-camera" aria-hidden="true"></i> Video Expired' :
                    '';
                break;
            case MESSAGE_TYPE_DISAPPEARING_PHOTO:
                body = isDisappearingMessageExpired(message) ?
                    '<i class="fa fa-photo" aria-hidden="true"></i> Photo Expired' :
                    '';
                break;
            case MESSAGE_TYPE_GIFT:
                var text = getMessageBody(message);
                try {
                    text = JSON.parse(text);
                    text = (text.text) ? emojione.toImage(_.escape(text.text)).replace(/([^>])\n/g, '$1<br/>') : '';
                    text = '<span class="message-gift fa fa-gift"></span> ' + text;
                } catch (e) {}
                body = text;
                break;
            case MESSAGE_TYPE_POSTCARD:
                body = getTemplate(
                    template.postcardTemplate,
                    {
                        body: emojione.toImage(_.escape(getMessageBody(message))).replace(/([^>])\n/g, '$1<br/>')
                    }
                );
                break;
            case MESSAGE_TYPE_STICKER:
                var stickerUid = message.sticker ? message.sticker.uid : '';
                var allStickers = stickers.stickers.concat(stickers.freeStickers);
                var sticker = allStickers.find(function (sticker) { return sticker.uid === stickerUid; });

                body = getTemplate(
                    template.messageStickerBodyTemplate,
                    {
                        thumbnail: (sticker && sticker.image && sticker.image.thumbnail) ?
                            '<img src="' + getPhotoUrl('/stickers/preview/' + sticker.image.preview, true) + '">' :
                            'Unknown sticker',
                        src: getPhotoUrl('/stickers/src/' + sticker.image.src),
                        uid: message.sid
                    }
                );
                break;
            default:
                var text = getMessageBody(message);
                body = emojione.toImage(_.escape(text)).replace(/([^>])\n/g, '$1<br/>');
                break;

        }

        return body;
    }

    /**
     * Get message media content
     * @param message
     * @param isOwner
     * @returns {string}
     */
    function getMediaContent(message, isOwner) {
        var body = '';

        switch (message.type) {
            case MESSAGE_TYPE_MEDIA:
                var media = '';

                if (message.media && Object.keys(message.media).length > 0) {
                    Object.keys(message.media).forEach(function (key) {
                        media += getFileWrap(message, message.media[key], isOwner, message.media[key].isStorage)
                    });
                }

                body = media;
                break;
            case MESSAGE_TYPE_DISAPPEARING_VIDEO:
            case MESSAGE_TYPE_DISAPPEARING_PHOTO:
                var media = '';

                if (message.media && Object.keys(message.media).length > 0) {
                    Object.keys(message.media).forEach(function (key) {
                        media += getFileWrap(message, message.media[key], isOwner, message.media[key].isStorage)
                    });
                }
                body = media;
                break;
        }

        return body;
    }

    function getFileWrapClassName(file, isOwner) {
        var className = 'photo';

        if (file.type == TYPE_VIDEO) {
            className = 'video';
        }

        className += ' relative';

        if (isOwner && file.status != FILE_STATUS_SEND && file.status != FILE_STATUS_PROCESSING) {
            className = ' delete';
        }

        switch (file.status) {
            case FILE_STATUS_DELETED:
                className += ' delivered-deleted';
                break;
            case FILE_STATUS_SEND:
            case FILE_STATUS_PROCESSING:
                className += ' send loading';
                break;
            case FILE_STATUS_ERROR:
                className += ' error-media';
                break;
            case FILE_STATUS_SAVED:
                className += ' save' + (file.type == TYPE_VIDEO ? ' video' : '');
                break;
            case FILE_STATUS_UPLOADED:
                className += ' uploaded';
                break;
        }

        return className;
    }
    /**
     * Get file wrap
     * @param message
     * @param file
     * @param isOwner
     * @param isStorage
     */
    function getFileWrap(message, file, isOwner, isStorage) {
        var className = getFileWrapClassName(file, isOwner);

        var templateId = (file.type == TYPE_VIDEO) ? template.mediaVideoPreviewTemplate : template.mediaPreviewTemplate;
        var isDeletedMessage = isOwner &&
            message.author.uid &&
            message.memberStatus[message.author.uid] &&
            message.memberStatus[message.author.uid].status === MESSAGE_STATUS_DELETED;
        var isDisappearedMessage = [MESSAGE_TYPE_DISAPPEARING_PHOTO, MESSAGE_TYPE_DISAPPEARING_VIDEO]
            .indexOf(message.type) >= 0;

        if (file.status == FILE_STATUS_SEND || file.status == FILE_STATUS_PROCESSING || file.status == FILE_STATUS_ERROR) {
            templateId = template.fileMessageUpload;
        } else if (
            isDisappearedMessage &&
            (
                [FILE_STATUS_DELETED].indexOf(file.status) < 0 && !isDeletedMessage
            )
        ) {
            templateId = (file.type == TYPE_VIDEO) ?
                template.mediaDisappearedVideoPreviewTemplate :
                template.mediaDisappearedPhotoPreviewTemplate;
        }

        var host = s3Host;//(isStorage) ?  : '';

        if (file.status == FILE_STATUS_SEND || file.status == FILE_STATUS_PROCESSING || file.status == FILE_STATUS_ERROR) {
            return getTemplate(templateId, {
                className: className,
                name: (file.file && file.file.name) ? _.escape(file.file.name) : 'None',
                progressPercent: 0,
                progressSize: '0 MB',
                totalSize: (file.file && file.file.size) ? (file.file.size / 1024 / 1024).toFixed(2) + ' MB' : 0,
                index: file.index,
                identity: message.channel.identity,
                messageSid: message.sid
            });
        } else if (file.status == FILE_STATUS_UPLOADED) {
            return getTemplate(templateId, {
                className: className,
                thumbnail: (file.file && file.file.thumbnail) ? host + (isStorage ? '/thumb/' : '' ) + file.file.thumbnail : '',
                src: (file.file && file.file.src) ? host + (isStorage ? '/src/' : '' ) + file.file.src : '',
                placeholder: (file.file && file.file.placeholder) ? file.file.placeholder : '',
                identity: message.channel.identity,
                sid: file.index,
                messageSid: message.sid,
                expireAt: null,
                expireStatus: null,
                expireTime: null,
                expireOpenClass: '',
            });
        } else {
            return getTemplate(templateId, {
                className: className,
                thumbnail: (file.thumbnail) ? getPhotoUrl(file.thumbnail) : '',
                src: (file.src && !file.isNew) ? getPhotoUrl(file.src) : '',
                placeholder: (file.placeholder && !file.isNew) ? file.placeholder : '',
                identity: message.channel.identity,
                sid: (file.isNew) ? file.index : file.sid,
                messageSid: message.sid,
                expireAt: isDisappearedMessage && file.disappearedExpireAt && !isMediaExpiredForUser(file.status) ?
                    file.disappearedExpireAt :
                    null,
                expireStatus: isDisappearedMessage && file.disappearedStatus ? file.disappearedStatus : null,
                expireTime: isDisappearedMessage && file.disappearedExpireAt && !isMediaExpiredForUser(file.status) ?
                    getTimeLeftString(file.disappearedExpireAt * 1000) :
                    null,
                expireOpenClass: isDisappearedMessage && file.disappearedStatus === DISAPPEARING_MEDIA_STATUS_OPENED
                    ? 'opened' : ''
            });
        }
    }

    function updateDisappearedMediaTimer() {
        $('.disappeared-media-timer').each(function () {
            var expireAt = $(this).data('expired-at');
            var status = $(this).data('expire-status');

            if (!expireAt || !status || isMediaExpiredForUser(status)) {
                return;
            }
            $(this).text(getTimeLeftString(expireAt * 1000));
        });
    }

    function getTimeLeftString(expireTimestamp) {
        var now = Date.now();
        var diff = Math.max(0, Math.floor((expireTimestamp - now) / 1000)); // разница в секундах

        var hours = Math.floor(diff / 3600);
        diff %= 3600;
        var minutes = Math.floor(diff / 60);
        var seconds = diff % 60;

        const pad = n => n.toString().padStart(2, '0');

        if (diff < 0) {
            return '00:00';
        }

        if (hours > 0) {
            return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        } else {
            return `${pad(minutes)}:${pad(seconds)}`;
        }
    }

    function isAvailableDeleteDisappearingMedia(message) {
        if ([MESSAGE_TYPE_DISAPPEARING_PHOTO, MESSAGE_TYPE_DISAPPEARING_VIDEO].indexOf(message.type) < 0) {
            return false;
        }

        if (!message.media || Object.keys(message.media).length <= 0) {
            return false;
        }

        var available = true;
        Object.keys(message.media).forEach(function (key) {
            var file = message.media[key];
            if (
                [DISAPPEARING_MEDIA_STATUS_NOT_USED, DISAPPEARING_MEDIA_STATUS_NEW]
                    .indexOf(file.disappearedStatus) < 0
            ) {
                available = false;
            }
        });

        return available;
    }

    /**
     * Get channel last message
     * @param chat
     * @param opponentUid
     */
    function getChatLastMessage(chat, opponentUid) {
        var messages = chat.message;

        if (!messages) {
            return '';
        }

        var message = null;
        var isSelf = false;

        Object.keys(messages).forEach(function (key) {
            if (messages[key].createdAt && (message === null || messages[key].createdAt > message.createdAt)) {
                message = messages[key];
                isSelf = opponentUid === message.uid;
            }
        });

        var body = '';
        if (!message) {
            return body;
        }

        switch (message.type) {
            case MESSAGE_TYPE_WINK:
                body = '<span class="chat-member__wink">\n' +
                    '                    <img src="/images/wink_chat.svg" alt=""/>\n' +
                    '                </span>';
                break;
            case MESSAGE_TYPE_DISAPPEARING_VIDEO:
            case MESSAGE_TYPE_DISAPPEARING_PHOTO:
            case MESSAGE_TYPE_MEDIA:
                var hasVideo = false;
                var hasPhoto = false;
                var timerWrap = '';

                if (message.media && Object.keys(message.media).length > 0) {
                    Object.keys(message.media).forEach((key) => {
                        if (message.media[key] == TYPE_PHOTO) {
                            hasPhoto = true;
                        } else if (message.media[key] == TYPE_VIDEO) {
                            hasVideo = true;
                        }
                    });
                }

                var icon  = hasVideo ?
                    '<img src="/images/video_chat.png" alt=""/>' :
                    (hasPhoto ? '<img src="/images/camera_chat.png" alt=""/>' : '');

                if ([MESSAGE_TYPE_DISAPPEARING_VIDEO, MESSAGE_TYPE_DISAPPEARING_PHOTO].indexOf(message.type) >= 0) {
                    var media = message.media && Object.keys(message.media).length > 0 ?
                        message.media[Object.keys(message.media)[0]] :
                        null;
                    var isVideo = MESSAGE_TYPE_DISAPPEARING_VIDEO == message.type;
                    icon = '<span class="fa fa-' + (isVideo ? 'video-camera' : 'photo') + '" aria-hidden="true"></span>';

                    timerWrap = '<span class="disappeared-media-timer"' +
                        ' data-expired-at="' + (message.disappearedExpireAt || '') + '"' +
                        ' data-expire-status="' + (message.disappearedStatus || '') + '"' +
                        '>' + (message.disappearedExpireAt ?
                            getTimeLeftString(message.disappearedExpireAt * 1000) :
                            '') +
                        '</span>';


                    if (
                        [DISAPPEARING_MEDIA_STATUS_USER_EXPIRED, DISAPPEARING_MEDIA_STATUS_TRANSLATOR_EXPIRED, DISAPPEARING_MEDIA_STATUS_SUPPORT_EXPIRED]
                            .indexOf(message.disappearedStatus) >= 0) {
                        timerWrap = ' <span class="disappeared-media-expired">' + (isVideo ? 'Video' : 'Photo') + ' Expired</span>';
                    }
                }

                body = '<span class="chat-member__media">' + icon + timerWrap +'</span>';
                break;
            case MESSAGE_TYPE_GIFT:
                body = '<span class="fa fa-gift"></span>';
                break;
            case MESSAGE_TYPE_POSTCARD:
                body = '<span class="fa fa-envelope-o"></span> Gratitude Letter';
                break;
            case MESSAGE_TYPE_STICKER:
                body = '<img src="/images/sticker_channel.svg" alt="Channel sticker"/>';
                break;
            default:
                var text = getMessageBody(message);
                if (text > 60) {
                    text = text.substring(0, 60) + '...';
                }

                text = emojione.toImage(_.escape(text)).replace(/#x27;/g, '\'').replace(/&amp;/g, '');
                if ([MESSAGE_TYPE_VIRTUAL_GIFT_REQUEST, MESSAGE_TYPE_VIRTUAL_GIFT].indexOf(message.type) >= 0) {
                    text = '<span class="fa fa-gift"></span> ' + text;
                }
                body = text;
                break;

        }

        return (isSelf ? '<span class="">You:</span> ': '') + body;
    }

    /**
     * Get profile thumbnail or blank image
     * @param member
     * @param param
     * @returns {string}
     */
    function getProfileThumbnail(member, param) {
        var photo = (member.gender && member.gender == GENDER_MALE)
            ? '/images/male-blank.png'
            : '/images/1.png';
        var attribute = param ? param : 'thumbnail';

        if (member.avatar && !member.avatar.empty && member.avatar[attribute]) {
            photo = getPhotoUrl(member.avatar[attribute]);
        }

        return photo;
    }

    /**
     * Get count of new message from chat chnnel
     * @param chat
     * @param ownerUid
     */
    function getCountNewMessages(chat, ownerUid) {
        var lastConsumeMessage = 0;
        var messages = chat.message;

        Object.keys(messages).forEach((key) => {
            if (messages[key] && messages[key].uid && messages[key].uid == ownerUid) {
                lastConsumeMessage = (isUndefined(messages[key].lastConsumeIndex)) ? 0 : messages[key].lastConsumeIndex;
            }
        });

        if (parseInt(lastConsumeMessage) >= parseInt(chat.index)) {
            return null;
        }

        return parseInt(chat.index) - parseInt(lastConsumeMessage);
    }

    profiles.lockWrap = lockWrap;
    chats.lockWrap = lockWrap;
    chat.lockWrap = lockWrap;
    input.lockWrap = lockWrap;
    main.brokenConnection = blockWrap;
    main.restartConnection = unBlockWrap;
    info.lockWrap = lockWrap;
    comments.lockWrap = lockWrap;
    profiles.unLockWrap = unLockWrap;
    chats.unLockWrap = unLockWrap;
    chat.unLockWrap = unLockWrap;
    info.unLockWrap = unLockWrap;
    comments.unLockWrap = unLockWrap;
    comments.clear = clear;
    profileMedia.clear = clear;
    info.clear = clear;


    /**
     * Move dom element to another position of the element list
     * @param objectSelector
     * @param objectsSelector
     * @param position
     */
    function moveObject(objectSelector, objectsSelector, position) {
        var objectsList = $(objectsSelector);
        var node = $(objectSelector);

        if (node.length <= 0 || objectsList.length <= 0) {
            return;
        }

        objectsList.eq(position).before(node);
    }

    /**
     * Add identity of count of new messages
     * @param uid
     * @param count
     */
    function addNewMessages(uid, count) {
        var element = this.container.find('.profiles[data-uid="' + uid + '"]').find('.profiles_new-messages');

        if (isUndefined(count) || count <= 0)
            element.removeClass('active');
        else {
            element.text(count);
            element.addClass('active');
        }
    }

    /**
     * Add or remove new messages from chat list
     * @param identity
     * @param count
     */
    function addNewChatMessages(identity, count) {
        var element = this.container.find('.chats[data-identity="' + identity + '"]').find('.profiles_new-messages');

        if (isUndefined(count) || count <= 0) {
            element.removeClass('active');
            element.text('');
            element.parents('.mail_list').eq(0).removeClass('has-newbie');
        } else {
            element.text(count);
            element.addClass('active');
            element.parents('.mail_list').eq(0).addClass('has-newbie');
        }
    }

    /**
     * Sorting object by parameter
     *
     * @param object
     * @param parameter
     * @param desc
     * @returns {string[]}
     */
    function sortObject(object, parameter, desc) {
        return Object.keys(object).sort(function(a, b) {
            if (desc) {
                return object[b][parameter] - object[a][parameter];
            } else {
                return object[a][parameter] - object[b][parameter];
            }
        });
    }

    function addEmpty(container, data, append) {
        var emptyTemplate = getTemplate(template.emptyContainer, data);

        if (isUndefined(append)) {
            container.html(emptyTemplate);
        } else {
            container.append(emptyTemplate);
        }
    }

    function removeEmpty(container) {
        container.find('.empty-wrap').remove();
    }

    function isEmpty(data) {
        if (!data || isUndefined(data))
            return true;

        if (typeof data === 'object' && data.length <= 0)
            return true;

        if (typeof data === 'object' && Object.keys(data).length <= 0)
            return true;

        return false;
    }

    function isUndefined(data) {
        return typeof data === "undefined"
    }

    function getTemplate(id, data) {
        var tpl = _.template(document.querySelector(id).innerHTML);
        return tpl((isEmpty(data)) ? {} : data);
    }

    function addPreloader(small, prepend, container, positionClass) {
        var loadTemplate = getTemplate(
            (small)
                ? template.smallPreloadTemplateContainer
                : template.preloadTemplateContainer,
                {
                    positionClass: positionClass ? positionClass : '',
                }
            ),
            wrap = (container) ? container : this.container;

        if (container) {
            removePreloader(small, container);
        } else {
            this.removePreloader(small);
        }

        if (prepend) {
            wrap.prepend(loadTemplate);
        } else {
            wrap.append(loadTemplate);
        }
    }

    function removePreloader(small, container) {
        var wrap = (container) ? container : this.container;

        wrap.find((small) ? '.wave-preloader-wrap' : '.relative-preloader').remove();
    }

    function lockWrap() {
        var lockTemplate = getTemplate(template.lockContainer, {});

        this.container.append(lockTemplate);
        this.removePreloader();
    }

    function blockWrap() {
        var lockTemplate = getTemplate(template.brokeContainer, {});
        if (this.container.find('.broken-wrap').length <= 0)
            this.container.append(lockTemplate);
    }

    function unBlockWrap() {
        this.container.find('.broken-wrap').remove();
    }

    function addErrorAlert(text, timeout, container) {
        var container = (!container) ? this.container : container,
            tmp = getTemplate(template.errorTemplateContainer, {text: text});

        container.append(tmp);

        if (timeout) {
            setTimeout(function () {
                removeErrorAlert(container);
            }, timeout);
        }
    }

    function removeErrorAlert(container) {
        var container = (!container) ? this.container : container;

        container.find('.alert-danger').remove();
    }

    function unLockWrap() {
        this.container.find('.lock-wrap').remove();
    }

    function getChatTimeFormat(milliseconds) {
        var now = new Date().getTime(),
            diff = Math.floor(((now - milliseconds) / 1000) / 60);

        if (diff < 1) {
            return 'Now';
        } else if (diff < 60) {
            return diff + " Min";
        } else if (diff < (60 * 24)) {
            return Math.floor((diff / 60)) + ' Hr';
        } else if (diff < (60 * 24 * 7)) {
            var date = new Date();
            date.setTime(milliseconds);

            return weekDayShort[date.getDay()];
        } else {
            var date = new Date();
            date.setTime(milliseconds);
            var month = date.getMonth() + 1;
            if(month < 10) {
                month = "0" + month;
            }

            return date.getDate() + '.' + month;
        }
    }

    function getMessageDayFormat (milliseconds) {
        var date = new Date();

        date.setTime(milliseconds);

        var day = date.getDate();
        var monthIndex = date.getMonth();
        var year = date.getFullYear();

        return day + ' ' + monthFull[monthIndex] + ' ' + year;
    }

    function getChatMessageDate(milliseconds) {
        var date = new Date();
        date.setTime(milliseconds);
        var hours = date.getHours(),
            minutes = date.getMinutes(),
            seconds = date.getSeconds(),
            ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12;
        minutes = minutes < 10 ? '0' + minutes : minutes;
        seconds = seconds < 10 ? '0' + seconds : seconds;

        return hours + ':' + minutes + ':' + seconds + ' ' + ampm;
    }

    function getDateFromTimestamp(timestamp, dateSeparator = ':', timeSeparator = ':') {
        var date = new Date();
        date.setTime(timestamp * 1000);

        var hours = (date.getHours() >= 10 ) ? date.getHours() : '0' + date.getHours(),
            minutes = (date.getMinutes() >= 10 ) ? date.getMinutes() : '0' + date.getMinutes(),
            day = (date.getDate() >= 10) ? date.getDate() : '0' + date.getDate(),
            year = date.getFullYear(),
            month = ((date.getMonth() + 1) >= 10) ? (date.getMonth() + 1) : '0' + (date.getMonth() + 1);

        return year + dateSeparator + month + dateSeparator + day + ' ' + hours + timeSeparator + minutes;
    }

    /**
     * Add error message to view
     * @param error
     * @param timeout
     * @param container
     */
    function addError(error, timeout, container) {
        var text = 'Some error happened. Please try again later.';

        if (!isUndefined(error.code) && !isUndefined(error.text)) {
            text = _.escape(error.text);
        }

        container = (!container) ? this.container : container;

        addErrorAlert(text, timeout, container);
    }

    /**
     * Toggle online status of user in a view
     * @param uid
     * @param online
     */
    function toggleOnline(uid, online) {
        var wraps = this.container.find('[data-member-uid="' + uid + '"]');
        var titleWrap = chat.titleContainer.find('.title[data-member-uid="' + uid + '"]');

        if (wraps.length <= 0) {
            return;
        }

        if (online) {
            wraps.find('.offline').addClass('hidden');
            wraps.find('.online').removeClass('hidden');

            if (titleWrap && titleWrap.length > 0) {
                chat.titleContainer.removeClass('offline');
                chat.titleContainer.addClass('online');
            }
        } else {
            wraps.find('.online').addClass('hidden');
            wraps.find('.offline').removeClass('hidden');

            if (titleWrap && titleWrap.length > 0) {
                chat.titleContainer.removeClass('online');
                chat.titleContainer.addClass('offline');
            }
        }
    }

    /**
     * Toggle favorite status of chat
     * @param identity
     * @param favorite
     */
    function toggleFavorite(identity, favorite, favouritesCount) {
        var wraps = this.container.find('[data-identity="' + identity + '"]');
        var titleWrap = chat.titleContainer.find('.title[data-identity="' + identity + '"]');

        if (wraps.length <= 0) {
            return;
        }

        if (favorite && favorite == CHANEL_FAVORITE) {
            wraps.find('.favorite').addClass('active');

            if (titleWrap && titleWrap.length > 0) {
                chat.titleContainer.find('.favorite').addClass('active');
                chat.titleContainer.find('.favorite').removeClass('disabled-fav').removeAttr('title');
            }
        } else {
            wraps.find('.favorite').removeClass('active');

            if (titleWrap && titleWrap.length > 0) {
                chat.titleContainer.find('.favorite').removeClass('active');
                if (favouritesCount && favouritesCount >= FAVOURITES_LIMIT) {
                    chat.titleContainer
                        .find('.favorite')
                        .addClass('disabled-fav');
                }
            }
        }
    }

    function showFavTooltip(el, message) {
        let tooltip = $('<div class="fav-tooltip"></div>').text(message);

        $('body').append(tooltip);

        let pos = $(el).offset();

        tooltip.css({
            top: pos.top - tooltip.outerHeight() - 5,
            left: pos.left + ($(el).outerWidth() / 2) - (tooltip.outerWidth() / 2)
        });

        tooltip.fadeIn(150);

        $(el).one('mouseleave', function () {
            tooltip.fadeOut(150, () => tooltip.remove());
        });
    }

    function timeUpdate() {
        chatsTimeUpdate();
        messagesTimeUpdate();
    }

    function chatsTimeUpdate() {
        var activeProfile = profiles.getActive();

        if (!activeProfile) {
            return;
        }

        var chatsList = chats.data[activeProfile.inner.uid];

        if (!chatsList || Object.keys(chatsList).length <= 0) {
            return;
        }

        Object.keys(chatsList).forEach(function (key) {
            var chat = chatsList[key];

            if (!chat || !chat.lastActivity) {
                return;
            }

            var wrap = chats.container.find('.chats[data-identity="' + key + '"]');

            if (wrap && wrap.length > 0) {
                wrap.find('.profiles_time').text(getChatTimeFormat(chat.lastActivity));
            }
        });
    }

    /**
     * Update time wraps in a chat
     */
    function messagesTimeUpdate() {
        var activeChat = chats.getActive();

        if (!activeChat) {
            return;
        }

        var messageList = chat.list[activeChat.identity];

        if (!messageList || Object.keys(messageList).length <= 0) {
            return;
        }

        Object.keys(messageList).forEach(function (key) {
            var message = messageList[key];

            if (!message || !message.created) {
                return;
            }

            var wrap = chat.container.find('.messages[data-sid="' + message.sid + '"]');

            if (wrap && wrap.length > 0) {
                wrap.find('.profiles_time').text(getChatTimeFormat(message.created));
            }
        });
    }

    /**
     * Validate file params
     * @param file
     * @returns {{text: string, status: boolean}|{mediaType: *, status: boolean}|{text: string, status: boolean}}
     */
    function isChatFileValid(file) {
        var size = file.size,
            type = file.type,
            name = file.name,
            format = null,
            allFormats = [];

        allFormats = allFormats.concat(UPLOAD_IMAGE_FILE_FORMATS, UPLOAD_VIDEO_FILE_FORMATS);

        if (name && name.length > 20) {
            name = name.substring(0, 20) + '...';
        }

        if (!size || !type || !name)
            return {
                status: false,
                text: 'Not valid file'
            };

        if (UPLOAD_VIDEO_FILE_FORMATS.indexOf(type) >= 0)
            format = TYPE_VIDEO;

        if (UPLOAD_IMAGE_FILE_FORMATS.indexOf(type) >= 0)
            format = TYPE_PHOTO;

        if (!format)
            return {
                status: false,
                text: name + ' - Not valid type of file. Accept only: ' + allFormats.join(', ')
            };

        if (format == TYPE_VIDEO) {
            let extension = file.name.split('.');

            if (extension.length <= 0 || CHAT_UPLOAD_VIDEO_EXTENSION.indexOf(extension[extension.length - 1].toLowerCase()) < 0)
                return {
                    status: false,
                    text: name + ' - Not valid video file extension. Accept only: ' + CHAT_UPLOAD_VIDEO_EXTENSION.join(', ')
                };
        }

        if (format == TYPE_VIDEO && size > CHAT_UPLOAD_MAX_VIDEO_FILE_SIZE)
            return {
                status: false,
                text: name + ' - Video can\'t be higher than ' + (CHAT_UPLOAD_MAX_VIDEO_FILE_SIZE / 1048576) + 'Mb'
            };

        if (format == TYPE_PHOTO && size > CHAT_UPLOAD_MAX_IMAGE_FILE_SIZE)
            return {
                status: false,
                text: name + ' - Image can\'t be higher than ' + (CHAT_UPLOAD_MAX_IMAGE_FILE_SIZE / 1048576) + 'Mb'
            };

        return {
            status: true,
            mediaType: format
        };
    }

    /**
     * Upload files to chat
     * @param ownerUid
     * @param identity
     * @param messageKey
     * @param files
     * @param cb
     */
    function uploadChatFiles(ownerUid, identity, messageKey, files, cb) {
        var url = '/media/agency-chat/upload-media/';

        Object.keys(files).forEach((key) => {
            var file = files[key],
                form = new FormData();

            if (file.status == FILE_STATUS_UPLOADED)
                return;

            form.append('src', file.file, file.file.name);
            form.append('type', file.type);
            form.append('mailUid', messageKey);

            $.ajax({
                url: url,
                method: 'POST',
                cache: false,
                contentType: false,
                processData: false,
                headers: {
                    token: profiles.getModelToken(ownerUid, identity)
                },
                data: form,
                xhr: function() {
                    var myXhr = $.ajaxSettings.xhr();
                    if(myXhr.upload){
                        myXhr.upload.addEventListener('progress',function (e){
                            if(e.lengthComputable) {
                                input.updateUploadProcess(e.total,  e.loaded, file, identity);
                            }
                        }, false);
                    }
                    return myXhr;
                },
            }).done(function(data) {
                    if (!data || !data.success) {
                        cb({ text: 'Can\'t upload selected file. Please try again later.' }, ownerUid, identity, messageKey, file);
                        return;
                    }

                    cb(null, ownerUid, identity, messageKey, file, data.data);
            }).fail(function (error) {
                cb({ text: 'Can\'t upload selected file. Please try again later.' }, ownerUid, identity, messageKey, file);
            });
        });
    }

    /**
     * Get formated message body
     * @param message
     * @param author
     * @param modelName
     * @returns {*|string}
     */
    function getNotifyContent(message, author, modelName) {
        var result = {
            title: 'New Message',
            body: '',
        };

        switch (message.type) {
            case MESSAGE_TYPE_WINK:
                document.dispatchEvent(
                    new CustomEvent(
                        'notifyNewActivity',
                        {
                            detail: {
                                username: author.first_name,
                                profile_username: modelName,
                                type: ACTIVITY_WINK
                            }
                        }
                    )
                );
                return null;
            case MESSAGE_TYPE_MEDIA:
            case MESSAGE_TYPE_DISAPPEARING_VIDEO:
            case MESSAGE_TYPE_DISAPPEARING_PHOTO:
                result.title ='<strong class="chat-notify-style-text">' + _.escape(author.first_name) + '</strong> send you new media message';
                break;
            case MESSAGE_TYPE_GIFT:
                result.title = '<strong class="chat-notify-style-text">' +_.escape(author.first_name) + '</strong> send you gift message';
                break;
            case MESSAGE_TYPE_POSTCARD:
                result.title = '<strong class="chat-notify-style-text">' +_.escape(author.first_name) + '</strong> send you gratitude letter';
                break;
            default:
                result.title = '<strong class="chat-notify-style-text">' +_.escape(author.first_name) + '</strong> send you text message';
                result.body = _.escape(getMessageBody(message).substring(0, 20));
                break;

        }

        return result;
    }

    /**
     * Show toaster with message and make sound
     *
     * @param message
     * @param modelName
     * @param playSound
     */
    function showNotifyNewMessage(message, modelName, playSound) {
        document.dispatchEvent(
            new CustomEvent(
                'NotifyPush',
                {
                    detail: {
                        heading: 'New message for <strong class="chat-notify-style-text">' + _.escape(modelName) + '</strong>',
                        text: message,
                        playSound: playSound
                    }
                }
            )
        );
    }

    function playNewTaskSound() {
        document.dispatchEvent(
            new CustomEvent(
                'NotifyNewTask',
                {
                    detail: {}
                }
            )
        );
    }

    /**
     * Send notify alert to model
     *
     * @param channel
     * @param message
     */
    function sendNotifyToModel(channel, message) {
        if (!message || !channel) {
            return;
        }

        if (chats.getActive() && chats.getActive().identity == channel.identity) {
            return;
        }

        var author = message.author;
        var members = channel.members;
        var modelId = null;
        var modelImportId = null;

        Object.keys(members).forEach(function(key) {
            if (members[key] && members[key].import_uid) {
                modelId = members[key].uid;
                modelImportId = members[key].import_uid;
            }
        });

        if (modelImportId && !isUndefined(profiles.data[modelImportId]) && author.uid != modelId) {
            var modelName = _.escape(profiles.data[modelImportId].inner.username);
            var notifyObject = getNotifyContent(message, author, modelName);

            if (notifyObject === null) {
                return;
            }

            var text = notifyObject.title;
            if (notifyObject.body.length) {
                text += '<br><small class="chat-notify-style-text">' + getMessageBody(notifyObject) + '</small>';
            }

            showNotifyNewMessage(text, modelName, true);
        }
    }

    /**
     * Get model id from active chat
     *
     * @returns {null|*}
     */
    chats.getActiveChatModelProfileId = function () {
        if (!chats.getActive()) {
            return null;
        }

        var members = chats.getActive().members;
        var modelId = null;

        Object.keys(members).forEach(function (key) {
            if (members[key] && members[key].import_uid) {
                modelId = members[key].uid;
            }
        });

        return modelId;
    };

    /**
     * Get user id from active chat
     *
     * @returns {null|*}
     */
    chats.getActiveChatUserId = function () {
        if (!chats.getActive()) {
            return null;
        }

        var members = chats.getActive().members;
        var userId = null;

        Object.keys(members).forEach(function (key) {
            if (members[key] && !members[key].import_uid) {
                userId = members[key].uid;
            }
        });

        return userId;
    };

    media.getMediaFiles = function () {
        var activeProfile = profiles.getActive();
        var activeChat = chats.getActive();
        var mediaTab = $('.chat__details-v2-wrap .details_tabs a[href="#media-container"]');

        if (
            !activeProfile ||
            !activeChat ||
            !activeChat.identity ||
            mediaTab.length === 0 ||
            !mediaTab.hasClass('active') ||
            typeof media.data[activeChat.identity] !== 'undefined'
        ) {
            return;
        }

        $('#media-main-wrap').html('');
        media.addPreloader(false, false);

        socket.instance.getChannelFiles(
            activeProfile.inner.uid,
            activeChat.identity,
            null,
            function (data, error) {
                media.receivedMediaFiles(activeChat.identity, data, error);
            }
        );
    }

    /**
     * Load more media files
     *
     * @param event
     */
    media.getMoreMediaFiles = function(event) {
        var activeProfile = profiles.getActive();
        var activeChat = chats.getActive();

        if (!activeProfile || !activeChat) {
            return;
        }

        if (isUndefined(media.loadMore[activeChat.identity]) || !media.loadMore[activeChat.identity].loadMore) {
            return;
        }

        if (!media.loadMore[activeChat.identity].token || media.loadMore[activeChat.identity].send) {
            return;
        }

        var position = event.target.scrollTop;
        var toTop = position + event.target.clientHeight;
        var toBottom = event.target.scrollHeight - toTop;
        var identity = activeChat.identity;

        if (toBottom > 10) {
            return;
        }

        media.addPreloader(true, false, null, 'position-static');
        media.loadMore[identity].send = true;

        socket.instance.getChannelFiles(
            activeProfile.inner.uid,
            identity,
            media.loadMore[identity].token,
            function(data, error) {
                if (chats.getActive() && chats.getActive().identity == identity) {
                    media.removePreloader(true);
                }

                media.receivedMediaFiles(identity, data, error, false, true);
                media.loadMore[identity].send = false;
            }
        );
    };

    /**
     * Get newbie media files
     *
     * @param ownerId
     * @param identity
     */
    media.getNewbieMediaFiles = function(ownerId, identity) {
        var files = {};

        if (!isUndefined(media.data[identity]))
            files = media.data[identity];

        var filesKey = Object.keys(files),
            token = null;

        if (filesKey.length >= 0) {
            filesKey.sort(function (a, b) {
                return parseInt(b.created) - parseInt(a.created);
            });

            if (!isUndefined(filesKey[0]))
                token = files[filesKey[0]].created;
        }

        if (token)
            socket.instance.getNewbieMedia(ownerId, identity, token, function (data, error) {
                if (error || !data || data.length <= 0)
                    return;

                media.receivedMediaFiles(identity, data, error, true);
            });
        else
            socket.instance.getChannelFiles(
                ownerId,
                identity,
                null,
                function(data, error) {
                    if (error || !data || data.length <= 0)
                        return;

                    media.receivedMediaFiles(identity, data, error, true);
                }
            );
    };

    /**
     * Received media forom chat
     *
     * @param identity
     * @param data
     * @param error
     * @param newbie
     * @param more
     */
    media.receivedMediaFiles = function (identity, data, error, newbie, more) {
        media.removePreloader();

        if (error) {
            alertError('Can\'t get media files.');
            return;
        }

        if (!data || data.length <= 0) {
            if (!more) {
                addEmpty(media.container, {text: 'There is no media.'});
            }
            media.loadMore[identity] = {
                loadMore: false,
                token: null
            };
            return;
        }

        if (!newbie && data.length < MEDIA_FILES_LIMIT) {
            media.loadMore[identity] = {
                loadMore: false
            };
        }


        for (var i = 0; i < data.length; i++) {
            var file = data[i];

            if (!file.sid) {
                continue;
            }

            if (isUndefined(media.data[identity])) {
                media.data[identity] = {};
            }

            media.data[identity][file.sid] = file;
        }

        media.renderMediaFiles(newbie);
    };

    /**
     * Render channel media files
     *
     * @param newbie
     */
    media.renderMediaFiles = function (newbie) {
        var activeChat = chats.getActive();

        media.removePreloader();

        if (!activeChat || (isUndefined(media.data[activeChat.identity]) || Object.keys(media.data[activeChat.identity]).length <= 0)) {
            addEmpty(media.container, {text: 'There is no media files.'});
            return;
        } else {
            removeEmpty(media.container);
        }

        var files = media.data[activeChat.identity];
        var filesKey = Object.keys(files);


        filesKey.sort(function (a, b) {
            return parseInt(b.created) - parseInt(a.created);
        });

        if (isUndefined(media.loadMore[activeChat.identity])) {
            media.loadMore[activeChat.identity] = {
                loadMore: true,
                token: null,
                send: false
            };
        }

        media.loadMore[activeChat.identity].token = files[filesKey[filesKey.length - 1]].created;

        for (var i = 0; i < filesKey.length; i++) {
            if (isUndefined(files[filesKey[i]])) {
                continue;
            }

            var file = files[filesKey[i]];

            media.renderMediaFile(file.identity, file, newbie);
        }
    };

    /**
     * Delete media file fro view
     *
     * @param sid
     */
    media.deleteMediaFileView = function (sid) {
        media.container.find('.message-user__files[data-sid="' + sid + '"]').remove();
    };

    /**
     * Render file view
     *
     * @param identity
     * @param file
     * @param prepend
     */
    media.renderMediaFile = function (identity, file, prepend) {
        var activeChat = chats.getActive();

        if (!activeChat || activeChat.identity !== identity) {
            return;
        }

        var object = file;

        if (object.private != MEDIA_ACCESS_TYPE_PRIVATE) {
            object.classPrivate = 'viewed';
        } else {
            object.classPrivate = '';
        }

        object.src = (object.src) ? getPhotoUrl(object.src) : object.src;
        object.thumbnail = (object.thumbnail) ? getPhotoUrl(object.thumbnail) : object.thumbnail;
        object.preview = (object.preview) ? getPhotoUrl(object.preview) : object.preview;
        var tpl = getTemplate(
            (file.type == TYPE_VIDEO) ? template.mediaFilesVideoTemplate : template.mediaFilesImgTemplate,
            object
        );

        var fileWrap = media.container.find('.message-user__files.media-file[data-sid="' + file.sid + '"]');

        if (fileWrap.length <= 0) {
            if (prepend) {
                media.container.prepend(tpl);
            } else {
                media.container.append(tpl);
            }
        } else {
            fileWrap.replaceWith(tpl);
        }
    };

    tasks.resetTasksData = function (active) {
        tasks.data = {
            tasks: {},
            activeTask: null,
            page: null,
            load: false
        };
        tasks.active = active || false;
    };

    tasks.getTaskByChannelIdentity = function (identity) {
        return tasks.data.tasks[identity] ? tasks.data.tasks[identity] : null;
    };

    tasks.getTaskBySid = function (sid) {
        var task = null;
        Object.keys(tasks.data.tasks).forEach(function (key) {
            if (tasks.data.tasks[key] && tasks.data.tasks[key].sid === sid) {
                task = tasks.data.tasks[key];
            }
        });
        return task;
    };

    tasks.addNewTask = function (task) {
        if (!tasks.active || !task.channelIdentity) {
            return;
        }

        socket.instance.getTaskByChannelIdentity([task.channelIdentity], function (data, error) {
            if (error || !data || !data.tasks || !data.tasks.length) {
                return;
            }

            if (data.tasks && data.tasks.length > 0) {
                data.tasks.forEach(function (task) {
                    tasks.data.tasks[task.channelIdentity] = Object.assign({}, task, { status: TASK_STATUS_ACTIVE });
                    // tasks.data.tasks[task.sid] = task;
                });
            }

            tasks.addOrUpdateTaskChannels(false);
        });
    };

    tasks.updateTasks = function (taskList, playSound) {
        if (playSound) {
            playNewTaskSound();
        }

        if (!tasks.active) {
            return;
        }
        var identities = taskList.map(function (task) {
            return task.channelIdentity;
        });

        socket.instance.getTaskByChannelIdentity(identities, function (data, error) {
            if (error || !data || !data.tasks || !data.tasks.length) {
                return;
            }

            if (data.tasks && data.tasks.length > 0) {
                data.tasks.forEach(function (task) {
                    tasks.data.tasks[task.channelIdentity] = Object.assign({}, task, { status: TASK_STATUS_ACTIVE });
                    // tasks.data.tasks[task.sid] = task;
                });
            }

            tasks.addOrUpdateTaskChannels(false);
        });
    }

    tasks.removeTask = function (identity) {
        if (!tasks.active || !Object.keys(tasks.data.tasks).length) {
            return;
        }

        var task = tasks.getTaskByChannelIdentity(identity);

        if (!task) {
            return;
        }

        if (tasks.data.activeTask && tasks.data.activeTask.channelIdentity === task.channelIdentity) {
            chats.container
                .find('.chats-task[data-identity="' + task.channelIdentity + '"]')
                .find('.profiles_task-skip')
                .remove();
            tasks.data.tasks[task.channelIdentity].status = TASK_STATUS_DISABLED;
            return;
        }

        delete tasks.data.tasks[task.channelIdentity];

        chats.container.find('.chats-task[data-identity="' + task.channelIdentity + '"]').remove();

        if (Object.keys(tasks.data.tasks).length === 0) {
            tasks.data.page = null;
            addEmpty(chats.container, {text: 'There is no tasks.'});
        }
    };

    tasks.updateTaskChannel = function (channel) {
        if (Object.keys(tasks.data.tasks).length === 0) {
            return;
        }

        var task = tasks.getTaskByChannelIdentity(channel.identity);

        if (!task) {
            return;
        }

        tasks.data.tasks[channel.identity].channel = channel;

        if (tasks.data.activeTask && tasks.data.activeTask.channelIdentity === task.channelIdentity) {
            tasks.data.activeTask = task;
        }
    };

    tasks.getTasksList = function (event, loadMore) {
        if (
            loadMore &&
            (tasks.data.load || !tasks.data.page || chats.getPositionToBottomAfterScroll(event) > 10)
        ) {
            return;
        }
        var position = loadMore ? event.target.scrollTop : null;

        chats.addPreloader(!!loadMore);

        tasks.data.load = true;

        socket.instance.getTasksList({ page: tasks.data.page }, function (data, error) {
            tasks.data.load = false;

            chats.removePreloader(!!loadMore);

            if (error) {
                alertError(error.text ? error.text : 'Can\'t get tasks list.');
                return;
            }

            if (data.tasks && data.tasks.length > 0) {
                data.tasks.forEach(function (task) {
                    tasks.data.tasks[task.channelIdentity] = Object.assign({}, task, { status: TASK_STATUS_ACTIVE });
                    // tasks.data.tasks[task.sid] = task;
                });
            }

            tasks.data.page = data.page ? data.page : null;

            tasks.addOrUpdateTaskChannels(loadMore);

            if (loadMore && position) {
                $(templates.chatsContainer).scrollTop(position);
            }
        });
    };

    tasks.getTaskProfileProjectId = function (task) {
        return profiles.data[task.importUid] &&
            profiles.data[task.importUid].outer &&
            profiles.data[task.importUid].outer[task.profile.uid] ?
                profiles.data[task.importUid].outer[task.profile.uid].project_id :
                0;
    };

    tasks.unselectTask = function () {
        if (!tasks.data.activeTask) {
            return;
        }

        tasks.data.activeTask = null;

        chats.container.find('.chats-task.active').removeClass('active');
        chat.container.html('');
        media.container.html('');
        input.disableInput();
        input.clearTyping();
        input.clearTextFieldError();
        tasks.setChatTitle();
        info.setUserData(null ,null);
        comments.clear();
        profileMedia.clear();
    };

    tasks.selectTask = function (identity) {
        if (!tasks.data.tasks[identity]) {
            return;
        }

        var task = tasks.data.tasks[identity];
        var profile = task.profile;

        if (task.isActive === false) {
            alertError('You can\'t open this task. One of the task participants has been deactivated.');
            return;
        }

        if (!profiles.data[profile.import_uid]) {
            alertError('You can\'t open this task. Please contact with support.');
            return;
        }

        tasks.data.activeTask = task;
        var channel = task.channel;
        var element = chats.container.find('[data-identity="' + identity + '"]');
        var chatCounters = chats.counters[profile.import_uid] || {};

        if (element.hasClass('active')) {
            return;
        }
        chats.container.find('.chats-task.active').removeClass('active');
        element.addClass('active');

        chat.container.html('');
        media.container.html('');
        chat.addPreloader();
        input.disableInput();
        input.clearTyping();
        input.clearTextFieldError();

        tasks.setChatTitle();
        info.setUserData(task.user, identity);

        comments.clear();
        comments.getActiveUserComments(false);

        profileMedia.clear();
        profileMedia.getActiveUserMedia();

        chats.setChatToHistory(chats.getActive());

        if (!isResponsive()) {
            updateFetalTabOnMobVersionAfterReRender();
        } else {
            document.dispatchEvent(new CustomEvent('resizeWithSream', {}));
        }

        if (!isUndefined(chat.list[identity]) && !isUndefined(chat.data[identity]) && chat.data[identity].loaded) {
            var dayFormat = null;
            var lastMessage = null;

            Object.keys(chat.list[identity]).forEach(function (key) {
                chat.addOrUpdateMessage(identity, chat.list[identity][key]);

                lastMessage = chat.list[identity][key];

                if (dayFormat === null) {
                    dayFormat = getMessageDayFormat(chat.list[identity][key].created);
                }

                var currentDay = getMessageDayFormat(chat.list[identity][key].created);

                if (currentDay !== dayFormat) {
                    chat.addDateLine(dayFormat, chat.list[identity][key].sid, true);
                    dayFormat = currentDay;
                }
            });

            if (dayFormat && lastMessage) {
                chat.addDateLine(dayFormat, lastMessage.sid);
            }

            chat.container.scrollTop(chat.container[0].scrollHeight);

            chat.removePreloader();
            input.addTextField();

            if (tasks.users[task.user.uid]) {
                chat.toggleOnline(profile.uid, !!tasks.users[task.user.uid].isOnline);
            }

            if (chats.data[profile.import_uid] && chats.data[profile.import_uid][identity]) {
                chats.toggleFavorite(
                    identity,
                    chats.data[profile.import_uid][identity].isFavorite,
                    chatCounters.favouritesCount || 0
                );
            }

            media.renderMediaFiles();

            if (chat.disconnectedChats.indexOf(identity) >= 0) {
                chat.removeDisconnectedChats(identity);
                chat.getNewbieChatMessages(profile.import_uid, identity);
            }

            input.setStickerMessageAnimation('selectChat');
        } else if (!channel) {
            chats.getChatOrCreateNewFromQuery({
                identity: identity,
                userUid: task.user.uid,
                ownerUid: profile.import_uid,
                profileUid: profile.uid
            }, function () {
                chat.receivedMessages(identity, {}, null);

                if (tasks.users[task.user.uid]) {
                    chat.toggleOnline(profile.uid, !!tasks.users[task.user.uid].isOnline);
                }

                input.addTextField();
            });
        } else {
            media.addPreloader();
            socket.instance.getChannelMessages(profile.import_uid, identity, function (data, error) {
                chat.receivedMessages(identity, data, error);

                if (isUndefined(chat.data[identity])) {
                    return;
                }

                chat.data[identity].loaded = true;
                chat.container.scrollTop(chat.container[0].scrollHeight);

                if (chats.data[profile.import_uid] && chats.data[profile.import_uid][identity]) {
                    chats.toggleFavorite(
                        identity,
                        chats.data[profile.import_uid][identity].isFavorite,
                        chatCounters.favouritesCount || 0
                    );
                }

                if (tasks.users[task.user.uid]) {
                    chat.toggleOnline(profile.uid, !!tasks.users[task.user.uid].isOnline);
                }

                input.addTextField();

                setTimeout(function () {
                    chat.consumeMessages();
                }, 500);
            });

            socket.instance.getFavouriteChannelsCount(profile.import_uid, function (data, error) {
                chats.updateFavouritesCount(data);

                chats.toggleFavorite(
                    identity,
                    chats.data[profile.import_uid][identity].isFavorite,
                    chatCounters.favouritesCount || 0
                );
            });
        }

        media.getMediaFiles();
        input.checkVirtualGift();
        input.checkWink();
        input.checkSticker();

        tasks.clearFinishedTasks();
    };

    tasks.clearFinishedTasks = function () {
        if (!Object.keys(tasks.data.tasks).length) {
            return;
        }

        Object.keys(tasks.data.tasks).forEach(function (key) {
            if (tasks.data.tasks[key] && tasks.data.tasks[key].status === TASK_STATUS_DISABLED) {
                tasks.removeTask(tasks.data.tasks[key].channelIdentity);
            }
        });
    };

    tasks.setChatTitle = function () {
        var task = tasks.data.activeTask;
        chat.clearTitle();

        if (!task) {
            return;
        }
        var user = task.user;
        var profile = task.profile;
        var channel = task.channel;
        var modelProfile = channel ?
            channel.members.find(function (member) {
                return member.uid === profile.uid;
            }) || null :
            null;

        var tpl = getTemplate(template.chatTitleTemplate, {
            identity: task.channelIdentity,
            uid: user.uid,
            importUid: task.importUid,
            thumbnail: getProfileThumbnail(user),
            username: _.escape(user.username),
            modelBanned: (modelProfile && modelProfile.status === CHANNEL_STATUS_BANNED) ? 'active' : ''
        });

        chat.titleContainer.removeClass('online');
        chat.titleContainer.addClass('offline');
        chat.titleContainer.html(tpl);

        chat.toggleOnline(user.uid, tasks.users[user.uid] && tasks.users[user.uid].isOnline);
        chats.toggleOnline(user.uid, tasks.users[user.uid] && tasks.users[user.uid].isOnline);
        chats.toggleFavorite(task.channelIdentity, (channel && channel.favorite) || CHANEL_NOT_FAVORITE);
    };

    tasks.showSkipTaskForm = function (task) {
        var modal = $('#skipTaskModal');
        var tpl = getTemplate(template.skipTaskFormTemplate, {
            sid: task.sid,
            options: skipTaskReasons.map(function (reason) {
                return '<option value="' + reason.value + '">' + _.escape(reason.text) + '</option>';
            })
        });

        modal.find('.modal-body').html(tpl);
        modal.modal('show');
    };

    tasks.hideSkipTaskForm = function () {
        $('#skipTaskModal').modal('hide');
    };

    tasks.skipTask = function (sid) {
        var task = tasks.getTaskBySid(sid);

        if (!task) {
            alertError('Can\'t skip this task. Please try again later.');
            return false;
        }

        tasks.showSkipTaskForm(task);
        return false;
    };

    tasks.validateSkipFormData = function (form, data) {
        var reason = data.map(function (item) {
            return item.name === 'reason' ? parseInt(item.value) : null;
        }).filter(function (item) {
            return !!item;
        });
        var isValid = true;

        if (reason.length === 0) {
            form.find('select[name="reason"]').parent().addClass('has-error');
            form.find('select[name="reason"]').after('<div class="text-danger">Skip reason required.</div>');
            isValid = false;
        }

        for (var i = 0; i < data.length; i++) {
            var item = data[i];

            switch (item.name) {
                case "uid":
                    if (item.value.replace(/\s/g, '').length === 0) {
                        isValid = false;
                        form.find('select[name="reason"]').parent().addClass('has-error');
                        form.find('select[name="reason"]').after('<div class="text-danger">Task id can\'t be empty.</div>');
                    }
                    break;
                case "reason":
                    if (
                        [SKIP_TASK_REASON_MISSMATCH, SKIP_TASK_REASON_OTHER, SKIP_TASK_REASON_NOT_ACTIVE, SKIP_TASK_REASON_MESSAGE_LIMIT_REACHED]
                            .indexOf(parseInt(item.value)) < 0
                    ) {
                        isValid = false;
                        form.find('select[name="reason"]').parent().addClass('has-error');
                        form.find('select[name="reason"]').after('<div class="text-danger">Skip reason is not valid.</div>');
                    }
                    break;
                case "description":
                    if (reason && reason[0] && parseInt(reason[0]) === SKIP_TASK_REASON_OTHER) {
                        var charsWithoutSpaces = item.value.replace(/\s/g, '').length;

                        if (charsWithoutSpaces === 0) {
                            isValid = false;
                            form.find('textarea[name="description"]').parent().addClass('has-error');
                            form.find('textarea[name="description"]')
                                .after('<div class="text-danger">Comment can’t be blank.</div>');
                        } else if (charsWithoutSpaces < 10) {
                            isValid = false;
                            form.find('textarea[name="description"]').parent().addClass('has-error');
                            form.find('textarea[name="description"]')
                                .after('<div class="text-danger">Comment must be at least 10 characters in length.</div>');
                        } else if (charsWithoutSpaces > 500) {
                            isValid = false;
                            form.find('textarea[name="description"]').parent().addClass('has-error');
                            form.find('textarea[name="description"]')
                                .after('<div class="text-danger">Comment must be not more 500 characters in length.</div>');
                        }
                    }
                    break;
            }
        }

        return isValid;
    };

    tasks.sendSkipTaskForm = function (data) {
        var params = {};

        data.forEach(function (item) {
            if (['uid', 'reason', 'description'].indexOf(item.name) >= 0) {
                params[item.name] = item.value;
            }
        });

        addPreloader(false, false, $('#skipTaskModal .modal-content'));

        socket.instance.skipTask(params, function (data, error) {
            removePreloader(false, $('#skipTaskModal .modal-content'));

            if (error) {
                alertError(error.text ? error.text : 'Can\'t skip this task. Please try again later.');
                return;
            }

            var task = tasks.getTaskBySid(params.uid);

            if (task && tasks.active) {
                if (tasks.data.activeTask && tasks.data.activeTask.sid === task.sid) {
                    tasks.unselectTask();
                }
                tasks.removeTask(task.channelIdentity);
            }

            tasks.hideSkipTaskForm();
        });
    };

    tasks.addOrUpdateTaskChannels = function (loadMore) {
        if (!loadMore && !Object.keys(this.data.tasks).length) {
            addEmpty(chats.container, { text: 'Task list is empty.' });
            return;
        }
        removeEmpty(chats.container);

        var tasks = this.data.tasks;

        var sorted = Object.keys(tasks).sort(function (a, b) {
            var priorityDiff = tasks[a].priority - tasks[b].priority;
            if (priorityDiff !== 0) {
                return priorityDiff;
            }

            return tasks[b].createdAt - tasks[a].createdAt;
        });

        this.data.tasks = {};

        for (var i = 0; i < sorted.length; i++) {
            var task = tasks[sorted[i]];

            this.data.tasks[task.channelIdentity] = task;

            chats.addTasksChat(task, i);
        }
    };

    tasks.setChatFavorite = function (identity) {
        if (!tasks.active || !tasks.data.activeTask) {
            return;
        }

        if (!tasks.data.activeTask.channel) {
            alertError('You can\'t add a chat to your favorites until it\'s created.');
            return;
        }

        var profile = tasks.data.activeTask.profile;
        var prevStatus = tasks.data.activeTask.channel.favorite;
        var newFavoriteStatus = (prevStatus === CHANEL_NOT_FAVORITE) ?
            CHANEL_FAVORITE :
            CHANEL_NOT_FAVORITE;
        var chatCounters = chats.counters[profile.import_uid] || {};
        var favouritesCount = chatCounters.favouritesCount || 0;
        var newFavouritesCount = newFavoriteStatus === CHANEL_FAVORITE ? favouritesCount + 1 : favouritesCount - 1;
        if (newFavoriteStatus === CHANEL_FAVORITE && favouritesCount >= FAVOURITES_LIMIT) {
            return;
        }

        tasks.data.activeTask.channel.favorite = newFavoriteStatus;
        tasks.data.tasks[tasks.data.activeTask.channelIdentity].channel.favorite = newFavoriteStatus;

        if (chats.data[profile.import_uid] && chats.data[profile.import_uid][identity]) {
            chats.data[profile.import_uid][identity].isFavorite = newFavoriteStatus;
            chats.counters[profile.import_uid].favouritesCount = newFavouritesCount;
        }

        if (chats.list[identity]) {
            chats.list[identity].favorite = newFavoriteStatus;
        }

        chats.toggleFavorite(identity, newFavoriteStatus, newFavouritesCount);

        socket.instance.toggleFavorite(profile.import_uid, identity, newFavoriteStatus, function (error) {
            if (error) {
                if (chats.data[profile.import_uid] && chats.data[profile.import_uid][identity]) {
                    chats.data[profile.import_uid][identity].isFavorite = prevStatus;
                    chats.counters[profile.import_uid].favouritesCount = favouritesCount;
                }
                if (chats.list[identity]) {
                    chats.list[identity].favorite = prevStatus;
                }

                chats.toggleFavorite(identity, prevStatus, favouritesCount);
            }
        });
    };

    /**
     * Get expexcted query params from url
     */
    function parseQueryParams() {
        var ownerUid = getParameterByName(URL_OWNER_UID_PARAMETER);
        var profileUid = getParameterByName(URL_PROFILE_UID_PARAMETER);
        var userUid = getParameterByName(URL_USER_UID_PARAMETER);

        if (!isEmpty(ownerUid)) {
            queryParams.ownerUid = ownerUid;
        }

        if (!isEmpty(profileUid)) {
            queryParams.profileUid = profileUid;
        }

        if (!isEmpty(userUid)) {
            queryParams.userUid = userUid;
        }

        if (!isEmpty(profileUid) || !isEmpty(userUid)) {
            queryParams.identity = getIdentityFromUsersId([profileUid, userUid]);
        }
    }

    /**
     * Get identity from user ui
     * @param uids
     * @return {*}
     */
    function getIdentityFromUsersId(uids) {
        uids.sort(function (a,b) {
            return a - b;
        });

        return uids.join('_');
    }
    /**
     * Helper function for get query parameter value
     *
     * @param name
     * @param url
     * @returns {string|null}
     */
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    /**
     * Show error toast
     *
     * @param message
     */
    function alertError(message) {
        if (typeof $.toast !== "undefined") {
            $.toast({
                heading: 'Error',
                text: message,
                showHideTransition : 'slide',
                allowToastClose : true,
                hideAfter : 10000,
                stack : 5,
                textAlign : 'left',
                position : 'top-right',
                icon: 'error',
                loader: true,
                loaderBg: '#d45c59'
            });
        }
    }

    /**
     * Get member profile of active chat
     *
     * @returns {null|*}
     */
    function getActiveMemberProfile() {
        var activeChat = chats.getActive();
        var activeProfile = profiles.getActive();

        if (!activeChat || !activeProfile) {
            return null;
        }

        if (tasks.active && tasks.data.activeTask) {
            return tasks.data.activeTask.user;
        }

        if (
            !chats.data ||
            isUndefined(chats.data[activeProfile.inner.uid]) ||
            isUndefined(chats.data[activeProfile.inner.uid][activeChat.identity])
        ) {
            return null;
        }

        return chats.data[activeProfile.inner.uid][activeChat.identity].memberProfile;
    }
    /**
     * Scroll to element view
     *
     * @param element
     */
    function scrollToView(element) {
        if (!element)
            return;

        try {
            if (element.length > 0)
                element[0].scrollIntoView(true);
            else
                element.scrollIntoView(true);
        } catch (e) {
            console.error(e.toString());
        }
    }

    /**
     * Send request to api
     *
     * @param url
     * @param projectId
     * @param data
     * @param cb
     * @param method
     * @param headers
     * @param dataType
     */
    function sendApiRequest(url, projectId, data, cb, method, headers, dataType) {
        var params = {
            url: url,
            method: (method) ? method : 'GET',
            cache: false,
            headers: headers ? headers : {
                token: getApiToken(projectId)
            },
            data: data
        };

        if (dataType) {
            params.dataType = dataType;
        }

        $.ajax(params)
            .done(function (response) {
                if (cb)
                    cb(response);
            })
            .fail(function (error) {
                cb(null, error);
            });
    }

    function toggleWrap(elemnt) {
        var wrapSelector = elemnt.attr('data-wrap'),
            group =  elemnt.attr('data-group'),
            elem = $(wrapSelector),
            icon = elemnt.find('.fa');

        if (!elem || elem.length <= 0)
            return;

        if (elem.hasClass('opened')) {
            elem.removeClass('opened');
            icon.attr('class', 'fa fa-chevron-up');
        } else {
            if (group) {
                var groupElements = $('.toggle-wrap-height[data-group="' + group + '"]');

                if (groupElements.length > 0) {
                    groupElements.each(function () {
                        var elem = $($(this).attr('data-wrap'));
                        if (elem.length > 0) {
                            elem.removeClass('opened');
                            $(this).find('.fa').attr('class', 'fa fa-chevron-up');
                        }
                    });
                }
            }

            elem.addClass('opened');
            icon.attr('class', 'fa fa-chevron-down');
        }
    }

    function playVideo(sid, src) {
        if (!src || !sid)
            return;

        var modal = $(template.modalViewVideo),
            time = (new Date()).getTime(),
            tpl = getTemplate(template.playerTemplate, { sid: sid, src: src, time: time });

        modal.find('.modal-body').html(tpl);

        videojs('#v-player-' + sid + '-' +time, {
            controls: true,
            autoplay: true,
            preload: 'auto'
        });

        if (isResponsive() && $('#chat-page').hasClass('nav-sm')) {
            $('#chat-page').removeClass('nav-sm').addClass('nav-md');
        }

        modal.modal('show');
    }

    /**
     * Push data to history without reload of page
     *
     * @param data
     */
    function pushToLocationHistory(data) {
        if (!data) {
            return;
        }

        if (Object.keys(data).length <= 0) {
            window.history.replaceState(null, null, '/chats/');
        } else {
            if (!URLSearchParams) {
                return ;
            }
            var urlParams = new URLSearchParams(window.location.search);

            if (!urlParams.get) {
                return;
            }

            for (var prop in data) {
                if (data.hasOwnProperty(prop)) {
                    if (!urlParams.has(prop) && data[prop].length > 0) {
                        urlParams.append(prop, data[prop]);
                        continue;
                    }
                    var urlParameter = urlParams.get(prop);

                    if (!urlParameter && data[prop].length <= 0) {
                        continue;
                    }

                    if (data[prop].length <= 0 && urlParams.delete) {
                        urlParams.delete(prop);
                        continue;
                    }

                    urlParams.set(prop, data[prop]);
                }
            }

            window.history.replaceState(null, null, '?' + urlParams.toString());
        }
    }

    /**
     * Open detail tab
     *
     * @param tab
     * @param ignoreMobile
     */
    function toggleDetailsTab(tab, ignoreMobile) {
        if (tab.hasClass('active'))
            return;

        var tabId = tab.attr('href'),
            chatDetailsWrap = $('.chat__details-v2-wrap'),
            tabContent = chatDetailsWrap.find(tabId);

        if (tabContent.length <= 0)
            return;

        chatDetailsWrap.find('.detail-tab-select').removeClass('active');
        chatDetailsWrap.find('.x_panel.active').removeClass('active');
        tabContent.addClass('active');
        tab.addClass('active');

        if (tabId === '#comments-container') {
            comments.showCommentForm();
        } else if (tabId === '#media-container') {
            media.getMediaFiles();
        }

        if (!ignoreMobile) {
            toggleMobileDetailsTab($('#chat_title-opponent').find('.detail-tab-select[href="' + tabId + '"]'), true);
        }
    }

    /**
     * Select tab for ombile version
     *
     * @param tab
     * @param ignoreDesktop
     */
    function toggleMobileDetailsTab(tab, ignoreDesktop) {
        if (tab.hasClass('active'))
            return;

        var tabId = tab.attr('href'),
            chatDetailsWrap = $('.chat__details-v2-wrap'),
            chatMessagesWrap = $('.chat__input-v2-inner-wrap'),
            tabs = $('#chat_title-opponent').find('.details_tabs a');

        tabs.removeClass('active');
        tab.addClass('active');

        if (tabId != "#message-main-wrap") {
            chatMessagesWrap.addClass('mobile-responsive');
            chatDetailsWrap.addClass('mobile-active');

            if (!ignoreDesktop) {
                toggleDetailsTab(
                    chatDetailsWrap.find('.detail-tab-select[href="' + tabId + '"]'),
                    true
                );
            }
        } else {
            chatMessagesWrap.removeClass('mobile-responsive');
            chatDetailsWrap.removeClass('mobile-active');
            input.resizeChatWrap();
        }
    }

    /**
     * Check is mobile or tablet device
     *
     * @returns {boolean}
     */
    function isResponsive() {
        return (window.innerWidth <= RESPONSIVE_FROM_WIDTH);
    }

    /**
     * Bach to list of channels on mobile version
     *
     * @param identity
     */
    function goToChannels(identity) {
        $('.chat__details-v2-wrap').removeClass('active').removeClass('mobile-active');
        $('.chat__input-v2-wrap').removeClass('active');
        $('.chat__input-v2-inner-wrap').removeClass('mobile-responsive');
        $('.chat__channels-v2-wrap').addClass('active');
        $('.chat__profile-v2-wrap').addClass('active');

        if (identity) {
            var ownerUid = getParameterByName(URL_OWNER_UID_PARAMETER);

            if (ownerUid) {
                profiles.setProfileToHistory(ownerUid);
            }

            chats.removeActiveChat();
            var channel = chats.container.find('.chats[data-identity="' + identity + '"]');
            document.dispatchEvent(new CustomEvent('resizeWithSream', {}));

            if (channel.length > 0) {
                scrollToView(channel.eq(0));
            }
        }
    }

    /**
     * Go to chat message wrap on mobile version
     */
    function goToMessages() {
        $('.chat__channels-v2-wrap').removeClass('active');
        $('.chat__profile-v2-wrap').removeClass('active');
        $('.chat__input-v2-wrap').addClass('active');
    }

    /**
     * Update mobile verion of detail tab after select new profile
     */
    function updateFetalTabOnMobVersionAfterReRender() {
        var chatDetailsWrap = $('.chat__details-v2-wrap'),
            activeTab = chatDetailsWrap.find('.detail-tab-select.active'),
            tabId = '#message-main-wrap';

        if (activeTab.length > 0 && activeTab.eq(0).attr('href') !== '#info-container') {
            tabId = activeTab.eq(0).attr('href');
        }
        $('#chat_title-opponent').find('.detail-tab-select').removeClass('active');
        $('#chat_title-opponent').find('.detail-tab-select[href="' + tabId + '"]').addClass('active');
    }

    /**
     *
     * @param img
     * @param webP
     * @return {*}
     */
    function getPhotoUrl(img, webP) {
        if (!img) {
            return img;
        }

        if (!s3Host || img.indexOf('https://') >= 0 || img.indexOf('http://') >= 0) {
            return img;
        }

        var imgUrl = (s3Host.substring(s3Host.length - 1) == '/')
            ? s3Host.substring(0, s3Host.length - 1) : s3Host;

        if (webP && window.isWebpCompatible) {
            var imgWebp = img.split('.');
            imgWebp[imgWebp.length - 1] = 'webp';
            img = imgWebp.join('.');
        }

        return imgUrl + img;
    }

    /**
     * Emmit message about new channels
     * @param channels
     * @return {boolean}
     */
    function emitStreamProfileChannels(channels) {
        if (!profiles.getActive() || channels.length <= 0) {
            return false;
        }

        if (isUndefined(chats.data[profiles.getActive().inner.uid])) {
            return false;
        }

        var profileChannels = chats.data[profiles.getActive().inner.uid];
        var users = [];

        for (var i = 0; i < channels.length; i++) {
            var channel = channels[i];

            if (!isUndefined(profileChannels[channel.identity])) {
                users.push(profileChannels[channel.identity].memberProfile.uid);
            }
        }

        emmitToStreamGetUserActiveSubscribe(users, profiles.getActive().inner.uid, true);
    }

    /**
     * Send event to streame
     * @param users
     * @param importUid
     * @param renew
     */
    function emmitToStreamGetUserActiveSubscribe(users, importUid, renew) {
        if (users.length > 0) {
            document.dispatchEvent(new CustomEvent(
                'streamProfileChannels',
                {
                    detail: {
                        importUid: profiles.getActive().inner.uid,
                        users: users,
                        renew: renew
                    }
                }
            ));
        }
    }

    /**
     * Update view with count of users in stream
     * @param data
     */
    function updateStreameSubscribersCount(data) {
        if (!profiles.getActive() || profiles.getActive().inner.uid !== data.importUid) {
            return;
        }

        $('.chat__stream-video-main-wrap').find('.counter-wrap').addClass('active');
        if (data.count > 0 && !$('.chat__stream-video-main-wrap').find('.counter-wrap').hasClass('more-one-subscribers')) {
            $('.chat__stream-video-main-wrap').find('.counter-wrap').addClass('more-one-subscribers');
        }
        $('.chat__stream-video-main-wrap').find('.counter-wrap').find('.count').text(data.count ? data.count : 0);
    }

    function getStreamSubscribersModal() {
        return $('#streamSubscribersModal');
    }

    function openStreamSubscribersModal() {
        getStreamSubscribersModal().modal('show');
    }

    function closeStreamSubscribersModal() {
        getStreamSubscribersModal().modal('hide');
    }

    function addLoadeerStreamSubscribersModal(apend) {
        if (apend) {
            addPreloader(null, null, getStreamSubscribersModal().find('.modal-body'))
        } else {
            addPreloader(null, null, getStreamSubscribersModal().find('.modal-body'))
        }
    }

    function removeLoadeerStreamSubscribersModal(apend) {
        removePreloader(null, getStreamSubscribersModal().find('.modal-body'))
    }

    function removeStreameSubscribersLoadMore() {
        getStreamSubscribersModal().find('#load-more-subscribers').remove();
    }

    function addStreameSubscribersLoadMore(token) {
        removeStreameSubscribersLoadMore();
        getStreamSubscribersModal()
            .find('.profiles-responsive-wrap')
            .after('<button type="button" id="load-more-subscribers" class="btn btn-primary btn-small center"' +
                ' data-token="' + token + '"' +
                '>Load more</button>')
    }

    function getActiveStreameSubscribers(more, token) {
        if (!profiles.getActive() || !profiles.getActive().inner.uid) {
            return;
        }

        if (!more) {
            getStreamSubscribersModal().find('.modal-body').html('');
            openStreamSubscribersModal();
            addLoadeerStreamSubscribersModal();
        } else {
            addLoadeerStreamSubscribersModal(true);
        }

        $.ajax({
            url: `${urls.streamSubscribers}?uid=${profiles.getActive().inner.uid}` + (token ? '&token=' + token : ''),
            method: 'GET',
            cache: false,
            contentType: 'application/json',
        })
            .done(function (response) {
                if (response.success) {
                    if (response.html.length === 0) {
                        if (!more) {
                            getStreamSubscribersModal()
                                .find('.modal-body')
                                .html(`<div class="alert alert-info">There are no profiles to show.</div>`);
                        }
                    } else {
                        if (!more) {
                            getStreamSubscribersModal()
                                .find('.modal-body')
                                .html(`<div class="profiles-responsive-wrap clients-page">${response.html}</div>`);
                        } else {
                            getStreamSubscribersModal()
                                .find('.modal-body')
                                .find('.profile-tile-wrap-outside')
                                .last()
                                .after(response.html);
                        }
                    }

                    if (response.token && parseInt(response.token) > 0) {
                        addStreameSubscribersLoadMore(response.token);
                    } else {
                        removeStreameSubscribersLoadMore();
                    }
                    return;
                }

                removeStreameSubscribersLoadMore();
                alertError('Can\'t get subscribed users.');
                closeStreamSubscribersModal();
            })
            .fail(function (error) {
                var errorText = 'Can\'t get subscribed users.';

                if (error.status) {
                    if (error.status === 404) {
                        errorText = 'Can\'t find selected profile.';
                    } else if (error.status === 403) {
                        errorText = 'You didn\'t have access to stream data of selected profile.';
                    }
                }

                closeStreamSubscribersModal();
                alertError(errorText);
            })
            .always(function () {
                removeLoadeerStreamSubscribersModal();
            });
    }

    function getMessageBody(data) {
        if (data && data.bodyOrigin && data.bodyOrigin.length > 0) {
            return data.bodyOrigin;
        }

        return data && data.body && data.body.length > 0 ? data.body : '';
    }

    function startChatWithStreamSubscriber(data, projectUid) {
        if (!profiles.getActive() || !profiles.getActive().inner.uid) {
            return;
        }
        closeStreamSubscribersModal();

        var outerProfiles = profiles.getActive().outer;

        if (!outerProfiles || Object.keys(outerProfiles).length === 0) {
            return;
        }

        var profileUid;
        Object.keys(outerProfiles).forEach(function (key) {
            var profile = outerProfiles[key];

            if (profile && profile.project_id == projectUid) {
                profileUid = profile.uid;
            }
        });

        if (!profileUid) {
            return;
        }

        pushToLocationHistory({
            [URL_OWNER_UID_PARAMETER]: parseInt(profiles.getActive().inner.uid),
            [URL_PROFILE_UID_PARAMETER]: parseInt(profileUid),
            [URL_USER_UID_PARAMETER]: parseInt(data.id)
        });

        parseQueryParams();
        removeEmpty(chats.container);

        chats.getChatOrCreateNewFromQuery(queryParams, updateSubscribedChannelsAfterGetNew);
    }

    function isMediaExpiredForUser(status){
        return [
            DISAPPEARING_MEDIA_STATUS_USER_EXPIRED,
            DISAPPEARING_MEDIA_STATUS_TRANSLATOR_EXPIRED,
            DISAPPEARING_MEDIA_STATUS_SUPPORT_EXPIRED,
        ].indexOf(status) >= 0;
    }

    function updateSubscribedChannelsAfterGetNew(data) {
        emitStreamProfileChannels([{identity: data.identity}]);
    }

    function isDisappearingMessageExpired(message) {
        var isExpired = false;

        Object.keys(message.memberStatus ? message.memberStatus : {}).forEach(function(key) {
            if ([MESSAGE_STATUS_FULLY_EXPIRED, MESSAGE_STATUS_EXPIRED].indexOf(message.memberStatus[key].status) >= 0) {
                isExpired = true;
            }
        });

        return isExpired;
    }
    function openDisappearingMedia(messageId, mediaId) {
        var identity = chats.getActive() && chats.getActive().identity;
        var activeProfile = profiles.getActive();

        if (!identity || !chat.list[identity] || !activeProfile) {
            return;
        }

        var message = chat.list[identity].filter((item) => item.sid === messageId)[0];

        if (
            !message ||
            [MESSAGE_TYPE_DISAPPEARING_VIDEO, MESSAGE_TYPE_DISAPPEARING_PHOTO].indexOf(message.type) < 0 ||
            !message.media[mediaId] ||
            message.media[mediaId].disappearedStatus !== DISAPPEARING_MEDIA_STATUS_NEW ||
            message.author.uid === chats.getActiveChatModelProfileId()
        ) {
            return;
        }

        socket.instance.openDisappearingMedia(
            identity,
            activeProfile.inner.uid,
            chats.getActive().sid,
            messageId,
            mediaId,
            function (data, error) {
                if (error) {
                    alertError(error.text || 'Can\'t open disappeared media. Please contact support.');
                }
        });
    }

    function isAvailableDisappearingMedia() {
        var identity = chats.getActive() && chats.getActive().identity;
        var activeProfile = profiles.getActive();

        if (!identity || !chat.list[identity] || !activeProfile) {
            return;
        }

        addPreloader(
            true,
            true,
            $('#select-disappeared-file-button'),
            'absolute'
        );
        $('#select-disappeared-file-button').addClass('load');

        socket.instance.isAvailableDisappearingMedia(
            identity,
            activeProfile.inner.uid,
            function (data, error) {
                $('#select-disappeared-file-button').removeClass('load');
                removePreloader(true, $('#select-disappeared-file-button'));

                if (error) {
                    alertError(error.text || 'Can\'t check access to send disappearing media.');
                    return;
                }

                if (data && data.isAvailable) {
                    $('#select-disappeared-file-button').attr('disabled', false);
                    $('#message-disappeared-files-upload').prop('disabled', false);
                } else {
                    $('#select-disappeared-file-button').attr('disabled', true);
                    $('#message-disappeared-files-upload').prop('disabled', true);
                }
            });
    }

    return {
        selectProfile: profiles.selectProfile,
        selectChat: chats.selectChat,
        sendMessage: input.sendMessage,
        editMessage: input.editMessage,
        clearEdit: input.clearEdit,
        updateMessage: input.updateMessage,
        deleteMessage: input.deleteMessage,
        deleteMedia: input.deleteMedia,
        reSendMessage: input.reSendMessage,
        fileChangedHandler: input.fileChangedHandler,
        removeSelectedFiles: input.removeSelectedFiles,
        playVideo: input.playVideo,
        playProfileVideo: profileMedia.playProfileVideo,
        toggleFavorite: chats.toggleChannelFavorite,
        setFilter: chats.setFilter,
        updateSettings: chats.updateSettings,
        clearFilter: chats.clearFilter,
        addFilter: chats.addFilter,
        selectCommunication: input.selectCommunication,
        attachFiles: input.attachFiles,
        goToChannels: goToChannels,
        getNewChatProfiles: newChat.getNewChatProfiles,
        getChatWith: newChat.getChatWith,
        //TODO remove after develop finisj
        getProfile: profiles,
        getChats: chats,
        getChat: chat,
        getInput: input,
        getNewbieProfileChannels: profiles.getNewbieProfileChannels,
        getUpdatedProfileChannels: profiles.getUpdatedProfileChannels,
        getNewbieChatMessages: chat.getNewbieChatMessages,
        deleteComment: comments.deleteComment,
        sendWink: input.sendWink,
        getMessageHistory: chat.getMessageHistory,
        closeMessageHistory: chat.closeMessageHistory,
        getActiveProfile: function () {
            return (profiles.getActive() && profiles.getActive().inner) ? profiles.getActive().inner : null;
        },
        openDisappearingMedia: openDisappearingMedia,
        openCatchUp: profiles.openCatchUp,
    };

    /**
     * Disable files select depends on user balance_free limit
     *
     * @returns {boolean}
     */
    function checkFilesSelectionAvailabilityDependingOnFreeBalance()
    {
        input.toggleFilesInputDisable();
        // if (chats.getActive() && profiles.getActive()) {
        //     if (
        //         !isUndefined(chats.data[profiles.getActive().inner.uid]) &&
        //         !isUndefined(chats.data[profiles.getActive().inner.uid][chats.getActive().identity])
        //     ) {
        //         var infoData = info.data[chats.data[profiles.getActive().inner.uid][chats.getActive().identity].memberProfile.uid];
        //
        //         if (null === infoData) {
        //             return false;
        //         }
        //
        //         if (isUndefined(infoData)) {
        //             setTimeout(function () {
        //                 checkFilesSelectionAvailabilityDependingOnFreeBalance();
        //             }, 2000);
        //         } else {
        //             return !updateFilesSelectByFreeBalance(infoData.balance_free, infoData.purchase_type);
        //         }
        //     }
        // }
        //
        // return false;
    }

    /**
     * Disable files select
     *
     * @returns {void}
     */
    function disableFilesSelect()
    {
        input.container.find(templates.inputFileFieldId).prop('disabled', true);
        input.container.find('#select-file-button').attr('disabled', true);
        input.container.find('button#select-communication-file').prop('disabled', true);
    }

    /**
     * Enable files select
     *
     * @returns {void}
     */
    function enableFilesSelect()
    {
        input.container.find(templates.inputFileFieldId).prop('disabled', false);
        input.container.find('#select-file-button').attr('disabled', false);
        input.container.find('button#select-communication-file').prop('disabled', false);
    }

    /**
     * Get user data by uid
     */
    function updateUserActiveDataByUid(userUid, successCb, failCb)
    {
        var profileUid = getParameterByName(URL_OWNER_UID_PARAMETER);

        if (!profileUid && chats.getActive() && chats.getActive().members) {
            var member = chats.getActive().members.find(function (member) {return member.uid !== userUid;});
            profileUid = member ? member.import_uid : null;
        }

        $.ajax({
            url: '/chats/user/' + userUid + '/?profileUid=' + profileUid,
            method: 'POST',
            cache: false,
        }).done(function(data) {
            if (successCb) {
                successCb(data);
            }
        }).fail(function () {
            if (failCb) {
                failCb();
            }
        });
    }

    /**
     * Update files select by balance_free
     */
    function updateFilesSelectByFreeBalance(balanceFree, purchaseType)
    {
        input.toggleFilesInputDisable();
        // if (purchaseType === PURCHASE_TYPE_PAYED) {
        //     enableFilesSelect();
        //     return true;
        // }
        //
        // if (balanceFree <= BALANCE_FREE_FOR_SEND_FILE_LIMIT) {
        //     enableFilesSelect();
        //     return true;
        // }
        //
        // disableFilesSelect();
        // return false;
    }

    /**
     * Chack member has already write message to active channel
     *
     * @returns {boolean}
     */
    function isUserAlreadyWriteMessageInActiveChat() {
        if (!chats.getActive() || !profiles.getActive()) {
            return false;
        }

        if (
            isUndefined(chats.data[profiles.getActive().inner.uid]) ||
            isUndefined(chats.data[profiles.getActive().inner.uid][chats.getActive().identity])
        ) {
            return false;
        }

        var chatData = chats.data[profiles.getActive().inner.uid][chats.getActive().identity];
        var chatDataActive = !(chatData || !chatData.memberProfile || !chatData.memberProfile.channel ||
            !chatData.memberProfile.channel.activeConnection);
        var chatListActive = !(!chats.list[chats.getActive().identity] || !chats.list[chats.getActive().identity].activeConnection);

        if (!chatDataActive && !chatListActive) {
            return false;
        }

        return true;
    }

    function isAvailableToSendFiles() {
        // if (!chats.getActive() || !profiles.getActive() || !profiles.getActive().inner) {
        //     return false;
        // }
        //
        // if (
        //     chats.data[profiles.getActive().inner.uid] &&
        //     chats.data[profiles.getActive().inner.uid][chats.getActive().identity] &&
        //     chats.data[profiles.getActive().inner.uid][chats.getActive().identity].memberProfile.uid &&
        //     info.data[chats.data[profiles.getActive().inner.uid][chats.getActive().identity].memberProfile.uid]
        // ) {
        //     var infoData = info.data[chats.data[profiles.getActive().inner.uid][chats.getActive().identity].memberProfile.uid];
        //
        //     if (updateFilesSelectByFreeBalance(infoData.balance_free, infoData.purchase_type)) {
        //         return true;
        //     }
        // }

        return isUserAlreadyWriteMessageInActiveChat();
    }

    /**
     * Dynamic update of attributes on an event
     * @param data
     */
    function realTimeAttributesUpdate(data)
    {
        $('#user-details-balance').text(data.balance);
        $('#user-details-pay-status').text((data.purchase_type == PURCHASE_TYPE_PAYED) ? 'Payed' : 'Free');
    }

    /**
     * Set cookie
     *
     * @param name
     * @param value
     * @param exdays
     * @param subdomains
     * @param min
     */
    function setCookie(
        name,
        value,
        exdays,
        subdomains,
        min
    ) {
        var expires = "";

        if (exdays) {
            var d = new Date();
            d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
            expires = "expires=" + d.toUTCString() + ";";
        }

        if (min) {
            var date = new Date();
            date.setTime(date.getTime() + min * 60 * 1000);
            expires = "expires=" + date.toUTCString() + ";";
        }

        var domain = window.location.hostname;

        if (subdomains) {
            domain = domain.split(".");
            domain = domain[domain.length - 2] + "." + domain[domain.length - 1];
        }

        document.cookie =
            name +
            "=" +
            value +
            ";" +
            expires +
            "path=/" +
            (subdomains ? ";domain=." + domain : "");
    }

    /**
     * Get cookie value
     * @param {string} cname Cookie name
     * @returns {string|boolean}
     */
    function getCookie(cname) {
        var name = cname + "=";
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(";");
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === " ") {
                c = c.substring(1);
            }
            if (c.indexOf(name) === 0) {
                return c.substring(name.length, c.length);
            }
        }
        return false;
    }

    /**
     * Get userInterests
     * @param userInterests
     */
    function getUserInterests(userInterests) {
        const profileUid = getParameterByName(URL_OWNER_UID_PARAMETER);

        if (!profileUid) {
            return;
        }

        $.ajax({
            url: '/chats/interests/' + profileUid + '/',
            method: 'GET',
        }).then(function(data) {
            const container = $('.user-interests');
            container.empty();

            if (!userInterests || !data || !data.interestsList) {
                container.text('--');
                return;
            }

            userInterests.forEach(function(interestId) {
                const label = data.interestsList[interestId];
                const isMatch = data.ownerInterests && data.ownerInterests.includes(interestId);
                const tag = $('<span>')
                    .addClass('profile-interest-tag')
                    .toggleClass('match', isMatch)
                    .text(label);

                container.append(tag);
            });
        }).catch(function () {
            $('.user-interests').text('--');
        });
    }
}
