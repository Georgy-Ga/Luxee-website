function Chat (config) {
    var
        ioInstance = config.ioInstance || io,
        host = config.host || '',
        port = config.port || '',
        path = config.path || '/',
        type = config.type || '',
        pingInterval = config.pingInterval || 5000,
        pingTimeout = config.pingTimeout || 25000,
        authToken = config.token || null,
        transports = config.transports || ['websocket', 'polling'],
        SocketIo = null,
        debug = config.debug || false,
        self = this,
        inited = config.inited || null,
        connected = null,
        User = null,
        Channels = [],
        DisconnectedChannels = [],
        DisconnectedMessageChannel = [],
        Messages = [],
        ChannelsToken = null,
        MessagesToken = {},
        Members = [],
        Media = [],
        Queue = [],
        HoldQueue = [],
        TYPING_INTERVAL = config.typingInterval || 3000,
        tipingEndInstaces = [],
        typingTimeout = null,
        MESSAGE_TYPE_TEXT = 1,
        MESSAGE_TYPE_MEDIA = 2,
        MESSAGE_TYPE_GIFT = 5,
        MESSAGE_TYPE_GIFT_REQUEST = 6,
        MESSAGE_TYPE_STICKER = 8,
        FIRST_MESSAGE_INDEX = 1,
        COUNT_MESSAGES_PER_CHANNEL = 20;

    var CONST_IDENTITY_SEPARATOR = '_',
        CONST_ERROR_MESSAGE = 'chat_error',
        CONST_SERVER_USER_AUTH_MESSAGE = 's_ua_success',
        CONST_SERVER_USER_UPDATED = 's_up_update',
        CONST_GET_ALL_CHANNELS = 'cl_ch_all',
        CONST_GET_MORE_CHANNELS = 'cl_ch_more',
        CONST_SERVER_GET_CHANNEL_LIST = 's_ch_list',
        CONST_SERVER_GET_UPDATED_CHANNEL_LIST = 's_chu_list',
        CONST_GET_MEMBER_CHANNEL = 'cl_ch_member',
        CONST_GET_MEMBER_CHANNEL_IF_EXIST = 'cl_ch_ex_member',
        CONST_SERVER_MEMBER_CHANNEL = 's_ch_member',
        CONST_SERVER_JOIN_NEW_CHANNEL = 'server_jn_ch',
        CONST_MEMBER_TYPING = 'cl_m_typ',
        CONST_SERVER_MEMBER_TYPING = 'server_m_typ',
        CONST_SERVER_DELIVER_ERROR = 's_m_error',
        CONST_SERVER_UPDATE_MESSAGE_ERROR = 's_um_error',
        CONST_NEW_USER_MESSAGE = 'cl_m_message',
        CONST_UPDATE_MESSAGE = 'cl_m_update',
        CONST_SERVER_NEW_MESSAGE = 'server_m_new',
        CONST_SERVER_UPDATE_CHANNEL = 'server_c_update',
        CONST_GET_CHANNEL_MESSAGES = 'cl_c_messages',
        CONST_CHANNEL_MESSAGES = 's_c_messages',
        CONST_GET_MORE_MESSAGES = 'cl_cm_messages',
        CONST_GET_CHANNEL_UPDATES = 'cl_c_updates',
        CONST_GET_NEWBIE_CHANNELS = 'cl_c_newbie',
        CONST_SERVER_NEWBIE_CHANNELS = 's_c_newbie',
        CONST_GET_CHANNEL_NEWBIE_MESSAGES = 'cl_cm_newbie',
        CONST_SEND_LAST_CONSUME_MESSAGE = 'cl_consume',
        CONST_SERVER_MESSAGE_UPDATE = 's_m_update',
        CONST_SERVER_MESSAGE_DELETE = 's_m_delete',
        CONST_DELETE_MESSAGE = 'c_m_del',
        CONST_DELETE_MEDIA = 'c_me_del',
        CONST_SHARED_MEDIA = 'c_sh_media',
        CONST_NEWBIE_MEDIA = 'c_nsh_media',
        CONST_SHARED_MEDIA_ERROR = 's_sf_error',
        CONST_NEW_SHARED_MEDIA = 's_nsh_media',
        CONST_SHARED_MEDIA_RECEIVED = 's_sh_media',
        CONST_DELETE_CHANNEL = 'cl_d_channel',
        CONST_CHANNEL_DELETED = 's_d_channel',
        CONST_BAN_USER = 'c_b_user',
        CONST_BAN_CHANNEL = 's_c_ban',
        CONST_USER_BECOME_ONLINE = 's_u_online',
        CONST_IS_USER_ONLINE = 'c_u_online',
        CONST_USER_BECOME_OFFLINE = 's_u_offline',
        CONST_USER_UPDATED = 's_u_updated',
        CONST_MEMBER_UPDATED = 's_m_updated',
        CONST_COUNT_NEW_MESSAGES = 's_mc_new',
        CONST_COUNT_NEW_MODEL_MESSAGES = 'sm_mc_new',
        CONST_GET_COUNT_NEW_MODEL_MESSAGES = 'cl_mc_new',
        CONST_SEARCH_CHANNEL = 'cl_c_search',
        CONST_IS_USERS_ONLINE = 'c_ul_online',
        CONST_USERS_LIST_ONLINE = 's_ul_online',
        CONST_GET_MODEL_PROFILES = 'cm_get_profiles',
        CONST_GET_MODEL_SIMPLE_PROFILES = 'cm_get_smp_profiles',
        CONST_GET_MODEL_PROFILES_NOTIFY = 'cm_get_profiles_notify',
        CONST_SORTED_MODEL_PROFILES = 'sm_profiles_sort',
        CONST_TOGGLE_FAVORITE = 'cl_tg_favorite',
        CONST_OPENED_GIFT = 's_open_gift',
        CONST_GET_MESSAGE_HISTORY = 'cl_m_history',
        CONST_MESSAGE_HISTORY = 's_m_history',
        CONST_CLIENT_SEND_STICKER_IS_AVAILABLE = 'cl_m_sticker_is_available',
        CONST_SERVER_SEND_STICKER_AVAILABLE = 's_m_sticker_available',
        CONST_OPEN_DISAPPEARED_MEDIA = 'cl_m_open_disappeared_media',
        CONST_IS_AVAILABLE_DISAPPEARED_MEDIA = 'cl_m_is_available_disappeared_media',
        CONST_GET_COUNT_NEW_TASK = 'cl_m_task_new',
        CONST_SERVER_COUNT_NEW_TASK = 's_task_count',
        CONST_GET_TASKS_LIST = 'cl_get_tasks',
        CONST_GET_TASKS_BY_IDENTITIES = 'cl_get_task_by_identities',
        CONST_SERVER_TASK_FINISHED = 's_task_finished',
        CONST_SERVER_NEW_TASK = 's_task_new',
        CONST_SERVER_TASKS_UPDATED = 's_tasks_updated',
        CONST_SKIP_TASK = 'cl_skip_task',
        CONST_SERVER_FAVOURITES_COUNT = 's_favourites_count',
        CONST_GET_FAVORITES_COUNT = 'cl_get_favorites_count';

    var errors = {
        NOT_AUTHORISED: 401
    };

    /**
     * Start connection by socket
     */
    this.connect = function() {
        SocketIo = ioInstance(host + (port ? ':' + port : ''),
            {
                pingInterval: pingInterval,
                pingTimeout: pingTimeout,
                path: path,
                query: {
                    token: authToken,
                    type: (type) ? type : null
                },
                transports: transports,
                transportOptions: {
                    polling: {
                        extraHeaders: {
                            token: authToken,
                        }
                    }
                }
            }
        );

        SocketIo.on('connect', function () {
            log('Socket connect');

            reconnect();

            setTimeout(moveMessageFromHoldQueue, 1500);

            if (!inited)
                eventListener();

            inited = true;
            connected = true;
        });

        SocketIo.on('connect_error', function () {
            log('Socket connection error.');
            self.connectionError();
        });
    };

    /**
     * Init event listeners
     */
    function eventListener() {
        SocketIo
            .on('disconnect', function (data) {
                log('Socket disconnected. Reason: ' + data.toString());
                connected = false;

                setChannelDisconnected();

                self.afterDisconnect();
            })
            .on('message', message);
    }

    /**
     * Prepare new message
     *
     * @param message
     */
    function message(message) {
        log('Received new message');
        message = (message && typeof message === 'object' && message.type) ? message : {};

        switch (message.type) {
            case CONST_ERROR_MESSAGE:
                chatError(message.data);
                break;
            case CONST_SERVER_USER_AUTH_MESSAGE:
                self.afterConnect(message.data);
                break;
            case CONST_SERVER_USER_UPDATED:
                setUser(message.data);
                break;
            case CONST_SERVER_GET_CHANNEL_LIST:
                setChannels(message.data);
                break;
            case CONST_SERVER_GET_UPDATED_CHANNEL_LIST:
                updateChannels(message.data);
                break;
            case CONST_SERVER_MEMBER_CHANNEL:
                addNewChannel(message.data);
                break;
            case CONST_SERVER_JOIN_NEW_CHANNEL:
                addNewChannel(message.data);
                self.joinNewChannel(message.data);
                break;
            case CONST_SERVER_NEWBIE_CHANNELS:
                addNewbieChannels(message.data);
                break;
            case CONST_SERVER_MEMBER_TYPING:
                memberStartTyping(message.data);
                break;
            case CONST_SERVER_DELIVER_ERROR:
                messageDeliverError(message.data);
                break;
            case CONST_SERVER_NEW_MESSAGE:
                addNewMessage(message.data);
                break;
            case CONST_SERVER_UPDATE_CHANNEL:
                updateChannel(message.data);
                break;
            case CONST_CHANNEL_MESSAGES:
                receiveChannelMessages(message.data);
                break;
            case CONST_SERVER_MESSAGE_UPDATE:
                updateMessage(message.data);
                break;
            case CONST_SERVER_MESSAGE_DELETE:
                eventDeleteMessage(message.data);
                break;
            case CONST_SERVER_UPDATE_MESSAGE_ERROR:
                updateMessageError(message.data);
                break;
            case CONST_SHARED_MEDIA_ERROR:
                messageSharedError(message.data);
                break;
            case CONST_NEW_SHARED_MEDIA:
                receivedNewMedia(message.data);
                break;
            case CONST_SHARED_MEDIA_RECEIVED:
                receivedSharedMedia(message.data);
                break;
            case CONST_CHANNEL_DELETED:
                channelDeleted(message.data);
                break;
            case CONST_BAN_CHANNEL:
                channelBaned(message.data);
                break;
            case CONST_USER_BECOME_ONLINE:
                userBecomeOnline(message.data);
                break;
            case CONST_USER_BECOME_OFFLINE:
                userBecomeOffline(message.data);
                break;
            case CONST_USER_UPDATED:
                userUpdated(message.data);
                break;
            case CONST_MEMBER_UPDATED:
                memberUpdated(message.data);
                break;
            case CONST_COUNT_NEW_MESSAGES:
                userNewMessagesCount(message.data);
                break;
            case CONST_COUNT_NEW_MODEL_MESSAGES:
                userNewModelMessagesCount(message.data);
                break;
            case CONST_USERS_LIST_ONLINE:
                userListOnline(message.data);
                break;
            case CONST_OPENED_GIFT:
                userOpenedGift(message.data);
                break;
            case CONST_SORTED_MODEL_PROFILES:
                //console.error('CONST_SORTED_MODEL_PROFILES', message.data);
                break;
            case CONST_MESSAGE_HISTORY:
                receiveMessageHistory(message.data);
                break;
            case CONST_SERVER_SEND_STICKER_AVAILABLE:
                stickerAvailable(message.data);
                break;
            case CONST_SERVER_COUNT_NEW_TASK:
                receivedCountOfNewTask(message.data);
                break;
            case CONST_SERVER_TASK_FINISHED:
                taskFinished(message.data);
                break;
            case CONST_SERVER_NEW_TASK:
                receivedNewTask(message.data);
                break;
            case CONST_SERVER_TASKS_UPDATED:
                receivedUpdatedTasks(message.data);
                break;
            case CONST_SERVER_FAVOURITES_COUNT:
                receiveFavouritesCount(message.data);
                break;
            default:
                self.receivedNewMessage(message.data);
        }

        executeQueueMessage(message);
    }

    /**
     * Prepare error
     * @param error
     */
    function chatError(error) {
        if (typeof error.message === "undefined" || error.message === null)
            return;

        switch (error.message.code) {
            case errors.NOT_AUTHORISED:
                closeConnection();
                self.authError();
                break;
        }
    }

    /**
     * Set user profile data
     * @param user
     */
    function setUser(user) {
        if (User === null) {
            User = user.message;

            log('Get user model');
            log(user);
        } else {
            User = user.message;
            self.userUpdated(User);

            log('User model updated');
            log(user);
        }
    }

    /**
     * Close connection by client
     */
    function closeConnection() {
        SocketIo.disconnect();
        log('Socket connection closed by client');
    }

    /**
     * Prepare message before send to server
     *
     * @param type
     * @param data
     * @returns {{type: *, data: {}, key: *}}
     */
    function prepareMessage(type, data) {
        return {
            type: type,
            data: (!data) ? {} : data,
            key: type + microtime(true) + '-' +random(1, 500)
        };
    }

    /**
     * Send message to server
     *
     * @param type
     * @param data
     * @param queue
     * @param cb
     * @param notDuplicate
     */
    function sendMessage(type, data, queue, cb, notDuplicate) {
        var message = prepareMessage(type, data);

        if (connected) {
            if (queue) {
                setMessageToQueue(message.key, message.type, data, cb);
            }

            SocketIo.send(message);
        } else {
            setRequestToHoldQueue(message.key, message.type, data, queue, cb, notDuplicate);
        }
    }

    /**
     * Get current microtime
     *
     * @param get_as_float
     * @returns {*}
     */
    function microtime(get_as_float) {
        var now = ((new Date()).getTime()) / 1000,
            s = parseInt(now);

        return (get_as_float) ? now : (Math.round((now - s) * 1000) / 1000) + ' ' + s;
    }

    /**
     * Generate random int
     *
     * @param max
     * @param min
     * @returns {*}
     */
    function random(max, min) {
        return Math.floor(Math.random() * (max - min)) + min;
    }

    /**
     * Make event after socket reconnected
     */
    function reconnect() {
        if (inited) {
            //getChannelUpdates();
            self.afterReconnect();
            log('Socket reconnected successfully.');
        }
    }

    /**
     * Set message to queue if need execute callback function
     *
     * @param key
     * @param type
     * @param data
     * @param cb
     */
    function setMessageToQueue(key, type, data, cb) {
        Queue[key] = {
            key: key,
            type: type,
            data: data,
            cb: cb,
        };
    }

    /**
     * Add request to hold queu if connection is broken
     *
     * @param key
     * @param type
     * @param data
     * @param queue
     * @param cb
     * @param notDuplicate
     */
    function setRequestToHoldQueue(key, type, data, queue, cb, notDuplicate) {
        if (notDuplicate) {
            removeDuplicateFormHoldQueue(type)
        }

        HoldQueue[key] = {
            key: key,
            type: type,
            data: data,
            queue: queue,
            cb: cb,
            notDuplicate: notDuplicate
        };
    }

    /**
     * Remove duplicate request from hold queue
     *
     * @param type
     * @param hold
     */
    function removeDuplicateFormHoldQueue(type, hold) {
        Object.keys(HoldQueue).forEach(function (key) {
            var typeQueue = HoldQueue[key].type;

            if (typeQueue == type) {
                delete HoldQueue[key];
            }
        });
    }

    /**
     * Move message form hold queue to execute queue
     */
    function moveMessageFromHoldQueue() {
        if (Object.keys(HoldQueue).length > 0) {
            Object.keys(HoldQueue).forEach(function (key) {
                if (connected) {
                    var message = HoldQueue[key];
                    delete HoldQueue[key];

                    sendMessage(message.type, message.data, message.queue, message.cb, message.notDuplicate);
                }
            });
        }
    }

    /**
     * Check received message in queue storage if it exist then execute callback function and drop it
     * @param message
     */
    function executeQueueMessage(message) {
        if (!message || typeof message.data === 'undefined' || typeof message.data.key === 'undefined') {
            return;
        }

        var key = message.data.key;

        if (typeof Queue[key] !== 'undefined') {
            var queue = Queue[key];
            delete Queue[key];

            if (queue && typeof queue.cb !== 'undefined') {
                let { status, error } = message.data;
                queue.cb(message.data.message, ((!status) ? error : null), (message.data.token) ? message.data.token : null);
            }
        }
    }

    /**
     * Add new channel to channel list
     * @param data
     */
    function addNewChannel(data) {
        if (!data.status) {
            log('Get error from add new channel method');
            log(data);
            return;
        }

        var channel = data.message;

        if (channel) {
            setChannel(channel);
            log('Add new channel to chanel list.');
        }
    }

    /**
     * Save into state channels
     * @param data
     */
    function setChannels(data) {
        if (!data.status) {
            log('Get error from chat list method');
            log(data);
            return;
        }

        var channels = data.message;

        if (typeof data.token !== 'undefined' && data.token) {
            ChannelsToken = (!ChannelsToken || ChannelsToken > data.token) ? data.token : ChannelsToken;
        } else {
            ChannelsToken = null;
        }

        if (Object.keys(channels).length > 0) {
            Object.keys(channels).forEach(function (key) {
                var channel = channels[key];

                setChannel(channel);
            });
        }

        log('Prepare channel list');
    }

    /**
     * Add new chanel to the channel list or update existing
     * @param channel
     */
    function setChannel(channel) {
        if (channel && Object.keys(channel).length > 0) {
            var members = channel.members;
            Channels[channel.identity] = channel;

            removeChannelFromDisconnected(channel.identity);

            setMembers(members, channel);
        }
    }

    /**
     * Get channel by identity
     *
     * @param identity
     * @returns {*}
     */
    function getChannel(identity) {
        if (typeof Channels[identity] !== 'undefined') {
            return Channels[identity];
        }

        return null;
    }

    /**
     * Add new or update existing members
     * @param members
     * @param channel
     */
    function setMembers(members, channel) {
        if (Object.keys(members).length > 0) {
            Object.keys(members).forEach(function (key) {
                var member = members[key];

                Members[member.uid] = member;
                Members[member.uid].channel = channel;
            });
        }
    }

    /**
     * Get member by uid
     *
     * @param uid
     * @returns {*}
     */
    function getMember(uid) {
        if (typeof Members[uid] === 'undefined')
            return null;

        return Members[uid];
    }

    /**
     * Debug lifecycle
     *
     * @param text
     * @param error
     */
    function log(text, error) {
        if (!debug)
            return;

        if (typeof localStorage !== 'undefined' && typeof localStorage.debug !== 'undefined')
            localStorage.debug = '*';

        if (typeof text === 'object') {
            text = JSON.stringify(text)
        }

        if (error) {
            console.error(text);
        } else {
            console.log(text);
        }
    }

    /**
     * Start member typing
     *
     * @param data
     */
    function memberStartTyping(data) {
        if (!data.message || typeof data.message.identity === 'undefined' || typeof data.message.memberUid === 'undefined') {
            return;
        }

        var channel = getChannel(data.message.identity),
            member = getMember(data.message.memberUid);

        if (!channel)
            return;

        if (typeof tipingEndInstaces[channel.identity] !== 'undefined') {
            clearTimeout(tipingEndInstaces[channel.identity]);
        }

        self.typingStart(channel, member);

        tipingEndInstaces[channel.identity] = setTimeout(function () {
            memberFinishTyping(channel, member);
        }, TYPING_INTERVAL);
    }

    /**
     * Finish member typing
     *
     * @param channel
     * @param member
     */
    function memberFinishTyping(channel, member) {
        if (typeof tipingEndInstaces[channel.identity] === 'undefined')
            return;

        clearTimeout(tipingEndInstaces[channel.identity]);
        delete tipingEndInstaces[channel.identity];

        self.typingEnd(channel, member);
    }

    /**
     * Send chat message
     *
     * @param ownerUid
     * @param identity
     * @param message
     * @param media
     * @param gift
     * @param sticker
     * @param tempKey
     * @param cb
     */
    function sendUserMessage(
        ownerUid,
        identity,
        type,
        message,
        media,
        gift,
        sticker,
        tempKey,
        cb
    ) {
        if (
            [
                MESSAGE_TYPE_GIFT,
                MESSAGE_TYPE_GIFT_REQUEST,
                MESSAGE_TYPE_STICKER
            ].indexOf(type) < 0
        ) {
            var validation = validateMessage(message, media);

            if (!validation.status) {
                cb(validation.error, ownerUid, identity, message, media, tempKey);
                return;
            }
        }


        try {
            sendMessage(
                CONST_NEW_USER_MESSAGE,
                {
                    body: message,
                    type: type,
                    media: media,
                    key: tempKey,
                    identity: identity,
                    ownerUid: ownerUid,
                    gift: gift ? gift : null,
                    sticker: sticker ? sticker : null,
                }
            );
        } catch (e) {
            log(e.toString());
            cb({
                code: 2,
                message: 'Message can\'t be send.'
            }, ownerUid, identity, message, media, tempKey);

            return;
        }

        cb(null, ownerUid, identity, message, media, tempKey);
    }

    /**
     * Update body of message
     *
     * @param ownerUid
     * @param identity
     * @param message
     * @param body
     * @param media
     * @param cb
     */
    function updateMessagePrivate(ownerUid, identity, message, body, media, cb) {
        var validation = validateMessage(body, media);

        if (!validation.status) {
            cb(validation.error, identity, message, body);
            return;
        }

        try {
            sendMessage(
                CONST_UPDATE_MESSAGE,
                {
                    ownerUid: ownerUid,
                    identity: identity,
                    sid: message.sid,
                    body: body
                }
            );
        } catch (e) {
            log(e.toString());
            cb({
                code: 2,
                message: 'Message can\'t be send.'
            }, identity, message, body);

            return;
        }

        cb(null, identity, message, body);
    }

    /**
     * Update body of message
     *
     * @param ownerUid
     * @param identity
     * @param status
     * @param cb
     */
    function toggleFavoritePrivate(ownerUid, identity, status, cb) {
        sendMessage(CONST_TOGGLE_FAVORITE, {
            ownerUid: ownerUid,
            identity: identity,
            status: status
        }, true, cb);
    }

    /**
     * Validate user new message body
     *
     * @param body
     * @param media
     * @returns {*}
     */
    function validateMessage(body, media) {
        if (!connected) {
            return {
                status: false,
                error: {
                    code: 1,
                    message: 'Can\'t send message. Connection temporary broken.'
                }
            };
        }

        if (!media || Object.keys(media).length <= 0) {
            body = body.replace(/[\s]+/g, '');

            if (body.length <= 0) {
                return {
                    status: false,
                    error: {
                        code: 2,
                        message: 'Message body can\'t be empty.'
                    }
                };
            }
        } else {
            var errors = {
                status: true,
                error: {
                    code: null,
                    message: ''
                }
            };

            Object.keys(media).forEach((key) => {
                var file = media[key];

                if (!file.file) {
                    errors.status = false;
                    errors.code = 3;
                    errors.text = 'Not valid format of file with name "' + name + '". ';
                }
            });

            if (!errors.status)
                return errors;
        }

        return {
            status: true
        };
    }


    /**
     * Validate and prepare error of message deliver
     *
     * @param data
     */
    function messageDeliverError(data) {
        if (!data || !data.message || !data.error)
            return;

        if (!data.message.identity || typeof Channels[data.message.identity] === 'undefined') {
            self.messageDeliveredError(data.message.identity, data.message, data.error, true);

            return;
        }

        self.messageDeliveredError(Channels[data.message.identity], data.message, data.error);
    }


    /**
     * Validate and prepare error of message deliver
     *
     * @param data
     */
    function messageSharedError(data) {
        if (!data || !data.message || !data.error)
            return;

        if (!data.message.identity || typeof Channels[data.message.identity] === 'undefined')
            return;

        self.afterMessageSharedError(data.message.identity, data.error);
    }

    /**
     * Receive favourites count
     * @param data
     * @returns {null}
     */
    function receiveFavouritesCount(data) {
        if (!data || !data.message)
            return null;

        self.afterReceiveFavouritesCount(data.message);
    }

    /**
     * Update channel
     *
     * @param data
     * @returns {null}
     */
    function updateChannel(data) {
        if (!data || !data.message || !data.message.channel)
            return null;

        var channel = data.message.channel,
            updates = data.message.updates;

        if (!channel.identity)
            return null;

        var isNew = (typeof Channels[channel.identity] === 'undefined');

        addNewChannel({ message: channel, status: true });

        if (isNew) {
            self.joinNewChannel(channel);
        } else {
            self.afterChannelUpdate(channel);
        }

        if (updates) {
            self.updatesAfterReconnect(channel);
        }
    }

    /**
     * Update cannels afyter received them fro api
     * @param data
     * @returns {null}
     */
    function updateChannels(data) {
        if (!data || !data.message)
            return null;

        var channels = data.message;

        if (channels && Object.keys(channels).length <= 0)
            return null;

        Object.keys(channels).forEach(function (key) {
            Channels[channels[key].identity] = channels[key];
        });

        self.afterChannelListGet(channels);
    }

    /**
     * Message update event
     * @param data
     * @returns {null}
     */
    function updateMessage(data) {
        if (!data || !data.message)
            return null;

        var message = data.message,
            channel = message.channel;

        if (!channel || !channel.identity || typeof Channels[channel.identity] === 'undefined')
            return null;

        if (typeof Messages[channel.identity] === "undefined")
            return null;

        if (typeof Messages[channel.identity][message.sid] === 'undefined')
            return null;

        Messages[channel.identity][message.sid] = message;

        self.afterMessageUpdate(channel, message);
    }

    /**
     * Add new message to chat
     *
     * @param data
     * @returns {null}
     */
    function addNewMessage(data) {
        if (!data || !data.message) {
            return null;
        }

        data = data.message;

        var message = data.message;

        if (typeof message.channel !== 'undefined') {
            updateChannel({ message: { channel: message.channel} });
        }

        addMessage(message);

        setMessageToken(message.channel);

        if (typeof data.request !== 'undefined') {
            self.messageDelivered(message.channel, data);
        } else {
            self.afterNewMessage(message.channel, message);
        }
    }

    /**
     * Add new message to state
     *
     * @param message
     * @returns {null}
     */
    function addMessage(message) {
        if (typeof message.channel === 'undefined')
            return null;

        if (typeof Messages[message.channel.identity] === 'undefined')
            Messages[message.channel.identity] = [];

        Messages[message.channel.identity][message.sid] = message;
    }

    /**
     * Add channel messages to state
     *
     * @param data
     * @returns {null}
     */
    function receiveChannelMessages(data) {
        if (!data || !data.message) {
            return null;
        }

        var messages = data.message;

        if (Object.keys(messages).length > 0) {
            var channel = messages[0].channel;

            setChannel(channel);

            Object.keys(messages).forEach(function (key) {
                addMessage(messages[key]);
            });

            if (Object.keys(messages).length < COUNT_MESSAGES_PER_CHANNEL)
                setMessageToken(channel, true);
            else
                setMessageToken(channel);
        }
    }

    function receiveMessageHistory(data) {
        if (!data || !data.message) {
            return null;
        }

        self.afterReceiveMessageHistory(data);
    }

    /**
     * Prepare load more token after upload messages of channel
     *
     * @param channel
     * @param last
     */
    function setMessageToken(channel, last) {
        if (typeof Channels[channel.identity] === 'undefined')
            return;

        if (typeof Messages[channel.identity] === 'undefined' || Object.keys(Messages[channel.identity]).length <= 0) {
            MessagesToken[channel.identity] = null;
            return;
        }

        if (last) {
            MessagesToken[channel.identity] = null;
            return;
        }

        var messages = Messages[channel.identity];

        var sortKeyMessages = Object.keys(messages).sort((a, b) => {
            return messages[a].index - messages[b].index;
        });

        if (typeof sortKeyMessages[0] !== 'undefined' && typeof messages[sortKeyMessages[0]] !== 'undefined') {
            MessagesToken[channel.identity] = messages[sortKeyMessages[0]].index;
            return;
        }

        MessagesToken[channel.identity] = null;
    }

    /**
     * Send message to back for get shared files of selected channel
     *
     * @param ownerUid
     * @param identity
     * @param token
     * @param cb
     */
    function getChannelFilesPrivate(ownerUid, identity, token, cb) {
        sendMessage(CONST_SHARED_MEDIA, { ownerUid: ownerUid, identity: identity, token: token }, true, cb);
    }

    /**
     * Get channel newbie media
     *
     * @param ownerUid
     * @param identity
     * @param token
     */
    function getChannelNewbieMedia(ownerUid, identity, token) {
        sendMessage(CONST_NEWBIE_MEDIA, { ownerUid: ownerUid, identity: identity, newbie: token });
    }

    /**
     * Update user object
     * @param data
     * @returns {null}
     */
    function userUpdated(data) {
        if (!data || !data.message)
            return null;

        var uid = data.message.uid;

        if (!uid || User.uid != uid)
            return null;

        User = data.message;

        self.afterUserUpdate(User);
    }

    /**
     * Update member account
     *
     * @param data
     * @returns {null}
     */
    function memberUpdated(data) {
        if (!data || !data.message)
            return null;

        var uid = data.message.uid;

        if (!uid || typeof Members[uid] === 'undefined')
            return null;

        var channel = Members[uid].channel;

        var members = channel.members;

        if (members && Object.keys(members).length > 0) {
            Object.keys(members).forEach(function (key) {
                if (members[key].uid == uid)
                    channel.members[key] = data.message;
            })
        }

        Members[uid] = data.message;
        Members[uid].channel = channel;

        Channels[channel.identity] = channel;

        var messages = (typeof Messages[channel.identity] !== 'undefined') ? Messages[channel.identity] : null;

        self.afterChannelUpdate(channel);
        self.afterMemberUpdate(channel.identity, Members[uid]);

        if (messages) {
            Object.keys(messages).forEach((key) => {
                Messages[channel.identity][key].channel = channel;
            });
        }
    }

    /**
     * Prepare count of new messages
     *
     * @param data
     * @returns {null}
     */
    function userNewMessagesCount(data) {
        if (!data || !data.message)
            return null;

        self.afterCountNewMessageReceived(data.message);
    }

    /**
     * Get count of new messages for model profiles
     *
     * @param settings
     */
    function getCountNewMessages(settings) {
        sendMessage(CONST_GET_COUNT_NEW_MODEL_MESSAGES, {settings: settings});
    }

    /**
     * Prepare count of new messages
     *
     * @param data
     * @returns {null}
     */
    function userNewModelMessagesCount(data) {
        if (!data || !data.message)
            return null;

        self.afterCountNewModelMessageReceived(data);
    }

    /**
     * Send message with search query to backend
     *
     * @param query
     * @param cb
     */
    function searchChannelPrivate(query, cb) {
        sendMessage(CONST_SEARCH_CHANNEL, { query: query }, true, cb, true);
    }

    /**
     * Search channel by query
     *
     * @param query
     * @param cb
     */
    this.searchChannel = function (query, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('searchChannel: callback function is required.');
        }

        if (!query || query.length <= 0)
            throw new Error('searchChannel: query can\'t be empty.');

        searchChannelPrivate(query, cb);
    };

    /**
     * @deprecated
     * Get maximal message index in a channel
     *
     * @param identity
     * @returns {*}
     */
    this.getLastMessage = function(identity) {
        if (typeof Channels[identity] === 'undefined' || typeof Messages[identity] === 'undefined')
            return null;

        var messages = Messages[identity];

        var sortKeyMessages = Object.keys(messages).sort((a, b) => {
            return messages[a].index - messages[b].index;
        });

        var key = Object.keys(sortKeyMessages).length - 1;

        if (typeof sortKeyMessages[key] !== 'undefined' && typeof messages[sortKeyMessages[key]] !== 'undefined') {
            return messages[sortKeyMessages[key]];
        }

        return null;
    };

    /**
     * Set all channels that was in state to disconnect list
     */
    function setChannelDisconnected() {
        if (Object.keys(Channels).length <= 0)
            return;

        Object.keys(Channels).forEach(function (key) {
            var channel = Channels[key];

            if (DisconnectedChannels.indexOf(channel.identity) < 0) {
                DisconnectedChannels[DisconnectedChannels.length] = channel.identity;
            }

            if (DisconnectedMessageChannel.indexOf(channel.identity) < 0) {
                DisconnectedMessageChannel[DisconnectedMessageChannel.length] = channel.identity;
            }
        })
    }

    /**
     * Remove channel from disconnected
     * @param identity
     */
    function removeChannelFromDisconnected(identity) {
        var key = DisconnectedChannels.indexOf(identity);

        if (key >= 0) {
            DisconnectedChannels.splice(key, 1);
        }
    }

    /**
     * Get updates for chaels that was uploaded yearly
     * @param identities
     * @param ownerUid
     * @param filters
     * @param settings
     */
    this.getChannelUpdates = function(identities, ownerUid, filters, settings) {
        if (!identities && identities.length <= 0)
            throw new Error('getChannelUpdates: property identities is required.');

        if (!ownerUid)
            throw new Error('getChannelUpdates: property ownerUid is required.');

        var params = {
            identities: identities,
            ownerUid: ownerUid
        };

        if (filters) {
            if (typeof filters.username !== 'undefined' && filters.username.length > 0)
                params.username = filters.username;

            if (typeof filters.uid !== 'undefined' && filters.uid.length > 0)
                params.uid = filters.uid;

            if (typeof filters.favorite !== 'undefined' && filters.favorite)
                params.favorite = filters.favorite;
        }

        if (settings)
            params.settings = settings;

        sendMessage(CONST_GET_CHANNEL_UPDATES, params, false, null, true);
    };

    /**
     * Get new channels that can be created when connection was broken
     *
     * @param ownerUid
     * @param lastActivity
     * @param filters
     * @param settings
     */
    this.getNewbieChannels = function(ownerUid, lastActivity, filters, settings) {
        var params = {
            ownerUid: ownerUid,
            lastActivity: lastActivity
        };

        if (filters) {
            if (typeof filters.username !== 'undefined' && filters.username.length > 0)
                params.username = filters.username;

            if (typeof filters.uid !== 'undefined' && filters.uid.length > 0)
                params.uid = filters.uid;

            if (typeof filters.favorite !== 'undefined' && filters.favorite)
                params.favorite = filters.favorite;
        }

        if (settings)
            params.settings = settings;

        sendMessage(CONST_GET_NEWBIE_CHANNELS, params, false, null, true);
    };

    /**
     * Add to storage newbie channels
     *
     * @param data
     * @returns {null}
     */
    function addNewbieChannels(data) {
        if (!data || !data.message)
            return null;

        var channels = data.message;

        if (Object.keys(channels).length > 0) {
            Object.keys(channels).forEach(function (key) {
                var channel = channels[key];
                if (!channel.identity)
                    return null;

                var isNew = (typeof Channels[channel.identity] === 'undefined');

                addNewChannel({ message: channel, status: true });

                if (isNew) {
                    self.joinNewChannel(channel);
                } else {
                    self.afterChannelUpdate(channel);
                }
            });
        }
    }

    /**
     * Send last consume message
     *
     * @param ownerUid
     * @param identity
     * @param index
     * @param settings
     */
    this.consumeMessage = function (ownerUid, identity, index, settings) {
        if (!ownerUid)
            throw new Error('consumeMessage: property "ownerUid" is required.');
        if (!identity)
            throw new Error('consumeMessage: property "identity" is required.');
        if (!index)
            throw new Error('consumeMessage: property "index" is required.');

        sendMessage(
            CONST_SEND_LAST_CONSUME_MESSAGE,
            { ownerUid: ownerUid, identity: identity, index: index, settings:settings },
            true,
            null,
            true
        );
    };

    /**
     * Private method for delete message
     *
     * @param ownerUid
     * @param identity
     * @param sid
     * @param cb
     */
    function deleteMessagePrivate(ownerUid, identity, sid, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('deleteMessagePrivate: callback function is required.');
        }

        if (!identity || !sid || !ownerUid)
            throw new Error('deleteMessagePrivate: set not valid params.');

        sendMessage(CONST_DELETE_MESSAGE, { ownerUid: ownerUid, identity: identity, sid: sid }, true, cb);
    }

    /**
     * Delete media for message
     *
     * @param identity
     * @param messageSid
     * @param sid
     * @param cb
     */
    function deleteMessageMediaPrivate(ownerUid, identity, messageSid, sid, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('deleteMessageMediaPrivate: callback function is required.');
        }

        if (!identity || !messageSid || !sid || !ownerUid)
            throw new Error('deleteMessageMediaPrivate: set not valid params.');

        sendMessage(CONST_DELETE_MEDIA, { ownerUid: ownerUid, identity: identity, messageSid: messageSid, sid: sid }, true, cb);
    }

    /**
     * Validate end emmit event of update message error
     *
     * @param data
     * @returns {null}
     */
    function updateMessageError(data) {
        if (!data.error || !data.message)
            return null;

        var message = data.message;

        if (!message.identity || !message.sid)
            return null;

        if (typeof Channels[message.identity] === 'undefined')
            return null;

        self.afterUpdateMessageError(data.error, message);
    }

    /**
     * Event when message was deleted
     *
     * @param data
     * @returns {null}
     */
    function eventDeleteMessage(data) {
        if (!data || !data.message)
            return null;

        if (!data.message.identity || !data.message.message)
            return null;

        var message = data.message.message;

        if (typeof Messages[data.message.identity] !== 'undefined' && typeof Messages[data.message.identity][data.message.message.index] !== 'undefined') {
            delete Messages[data.message.identity][data.message.message.sid];
        }

        self.afterMessageDelete(data.message.identity, message.sid, data.message.message);
    }

    /**
     * Received new media
     *
     * @param data
     * @returns {null}
     */
    function receivedNewMedia(data) {
        if (!data || !data.message)
            return null;

        var files = data.message;

        if (Object.keys(files).length <= 0)
            return null;

        var identityFiles = {};

        Object.keys(files).forEach(function (key) {
            var file = files[key];

            if (file.identity && typeof Channels[file.identity] !== 'undefined') {
                if (!identityFiles[file.identity])
                    identityFiles[file.identity] = [];
                if (typeof Media[file.identity] === 'undefined')
                    Media[file.identity] = {};

                Media[file.identity][file.sid] = file;

                identityFiles[file.identity].push(file);
            }
        });

        if (Object.keys(identityFiles).length > 0) {
            Object.keys(identityFiles).forEach(function (identity) {
                if (!identityFiles.hasOwnProperty(identity))
                    return;

                self.afterReceivedNewMedia(identity, identityFiles[identity]);
            });
        }
    }

    /**
     * Save media to state
     *
     * @param data
     * @returns {null}
     */
    function receivedSharedMedia(data) {
        if (!data || !data.message)
            return null;

        var files = data.message;

        if (Object.keys(files).length <= 0)
            return null;

        Object.keys(files).forEach(function (key) {
            var file = files[key];

            if (file.identity && typeof Channels[file.identity] !== 'undefined') {
                if (typeof Media[file.identity] === 'undefined')
                    Media[file.identity] = {};

                if (typeof Media[file.identity][file.sid] === 'undefined')
                    self.afterReceivedNewMedia(file.identity, file);

                Media[file.identity][file.sid] = file;
            }
        });
    }

    /**
     * Delete client channel
     *
     * @param identity
     * @param cb
     */
    this.deleteChannel = function (identity, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('deleteChannel: callback function is required.');
        }

        sendMessage(CONST_DELETE_CHANNEL, { identity: identity }, true, cb);
    };

    /**
     * Delete channels and message from state
     *
     * @param data
     * @returns {null}
     */
    function channelDeleted(data) {
        if (!data || !data.message || !data.message.identity)
            return null;

        if (typeof Channels[data.message.identity] !== 'undefined')
            delete Channels[data.message.identity];

        if (typeof Messages[data.message.identity] !== 'undefined')
            delete Messages[data.message.identity];

        self.afterChannelDeleted(data.message.identity);
    }

    /**
     * Event after user become online
     *
     * @param data
     * @returns {null}
     */
    function userBecomeOnline(data) {
        if (!data || !data.message || !data.message.uid)
            return null;

        self.afterUserBecomeOnline(data.message.uid);
    }

    /**
     * Event after user become offline
     *
     * @param data
     * @returns {null}
     */
    function userBecomeOffline(data) {
        if (!data || !data.message || !data.message.uid)
            return null;

        self.afterUserBecomeOffline(data.message.uid);
    }

    /**
     * Check is user online
     *
     * @param uid
     */
    this.isUserOnline = function(uid) {
        sendMessage(CONST_IS_USER_ONLINE, { uid: uid }, true);
    };

    /**
     * Delete baned channels and message from state
     *
     * @param data
     * @returns {null}
     */
    function channelBaned(data) {
        if (!data || !data.message || !data.message.identity || !data.message.uid || !data.message.importUid)
            return null;

        self.afterChannelBaned(data.message);
    }

    /**
     * Ban user
     *
     * @param identity
     * @param uid
     */
    this.banUser = function (identity, uid) {
        if (!identity || !uid) {
            throw 'banUser: identity and user uid is required params.';
        }

        sendMessage(CONST_BAN_USER, { identity: identity, uid: uid }, true);
    };

    /**
     * Delete user message
     *
     * @param ownerUid
     * @param identity
     * @param sid
     * @param cb
     */
    this.deleteMessage = function (ownerUid, identity, sid, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('deleteMessage: callback function is required.');
        }

        deleteMessagePrivate(ownerUid, identity, sid, cb);
    };

    /**
     * Delete user media file from message
     *
     * @param ownerUid
     * @param identity
     * @param messageSid
     * @param sid
     * @param cb
     */
    this.deleteMessageMedia = function (ownerUid, identity, messageSid, sid, cb) {
        deleteMessageMediaPrivate(ownerUid, identity, messageSid, sid, cb);
    };

    /**
     * Event after connection
     * @param data
     */
    this.afterConnect = function (data) {};

    /**
     * Event after socket disconnection
     * @param data
     */
    this.afterDisconnect = function (data) {};

    /**
     * Event of new message receive
     * @param msg
     */
    this.receivedNewMessage = function (msg) {};

    /**
     * Event after user was not auth
     */
    this.authError = function () {};

    /**
     * Event after user profile update
     * @param user
     */
    this.userUpdated = function (user) {};

    /**
     * Get user profile model
     * @returns {{uid: *, first_name: *, last_name: *, gender: *}}
     */
    this.getUser = function () {
        return User;
    };

    /**
     * Gel list of all channels
     *
     * @param ownerUid
     * @param filters
     * @param settings
     * @param cb
     */
    this.getChannelList = function (ownerUid, filters, settings, cb) {
        if (!ownerUid)
            throw new Error('getChannelList: ownerUid is required.');

        if (!cb || typeof cb !== 'function') {
            throw new Error('getChannelList: callback function is required.');
        }

        var params = {
            ownerUid: ownerUid
        };

        if (filters) {
            if (typeof filters.username !== 'undefined' && filters.username.length > 0) {
                params.username = filters.username;
            }

            if (typeof filters.uid !== 'undefined' && filters.uid.length > 0) {
                params.uid = filters.uid;
            }

            if (typeof filters.favorite !== 'undefined' && filters.favorite) {
                params.favorite = filters.favorite;
            }

            if (typeof filters.unAnswered !== 'undefined' && filters.unAnswered) {
                params.unAnswered = filters.unAnswered;
            }
        }

        if (settings) {
            params.settings = settings;
        }

        log('Get list of all channels');
        sendMessage(CONST_GET_ALL_CHANNELS, params, true, cb, true);
    };

    /**
     * Try to get sorted list of model profiles
     *
     * @param uids
     * @param settings
     * @param cb
     */
    this.getModelsProfiles = function (uids, settings, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('getModelsProfiles: callback function is required.');
        }

        log('Get list of model profiles');

        sendMessage(
            CONST_GET_MODEL_PROFILES,
            {uids: (!uids) ? [] : uids, settings: settings},
            true,
            cb,
            true
        );
    };

    /**
     * Try to get sorted list of model profiles
     *
     * @param uids
     * @param settings
     * @param cb
     */
    this.getModelsProfilesSimple = function (uids, settings, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('getModelsProfiles: callback function is required.');
        }

        log('Get list of model profiles');

        sendMessage(
            CONST_GET_MODEL_SIMPLE_PROFILES,
            {uids: (!uids) ? [] : uids, settings: settings},
            true,
            cb,
            true
        );
    };

    /**
     * Try to get sorted list of model profiles for notification
     *
     * @param uids
     * @param settings
     * @param cb
     */
    this.getModelsProfilesNotify = function (uids, settings, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('getModelsProfiles: callback function is required.');
        }

        log('Get list of model profiles');

        sendMessage(
            CONST_GET_MODEL_PROFILES_NOTIFY,
            {uids: (!uids) ? [] : uids, settings: settings},
            true,
            cb,
            true
        );
    };


    /**
     * Get list of channel messages
     *
     * @param ownerUid
     * @param identity
     * @param cb
     * @param newbie
     * @param updated
     */
    this.getChannelMessages = function (ownerUid, identity, cb, newbie, updated) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('getChannelMessages: callback function is required.');
        }

        if (!identity) {
            throw new Error('getChannelMessages: property "identity" required.');
        }

        if (!ownerUid) {
            throw new Error('getChannelMessages: property "ownerUid" required.');
        }

        if (newbie && !updated)
            throw new Error('getChannelMessages: property "updated" required for getting newbie messages.');

        log('Get list of channel messages');

        if (typeof newbie !== "undefined") {
            sendMessage(CONST_GET_CHANNEL_NEWBIE_MESSAGES, { ownerUid: ownerUid, identity: identity, updated: updated }, true, cb, true);

            //getChannelNewbieMedia(identity);
        } else
            sendMessage(CONST_GET_CHANNEL_MESSAGES, { ownerUid: ownerUid, identity: identity }, true, cb, true);
    };

    /**
     * Get message history
     *
     * @param sid
     * @param ownerUid
     * @param identity
     * @param cb
     */
    this.getMessageHistory = function (sid, ownerUid, identity, cb) {
        if (!sid) {
            throw new Error('getChannelMessages: property "sid" required.');
        }

        if (!cb || typeof cb !== 'function') {
            throw new Error('getChannelMessages: callback function is required.');
        }

        if (!ownerUid) {
            throw new Error('getChannelMessages: property "ownerUid" required.');
        }

        log('Get list message history');

        sendMessage(CONST_GET_MESSAGE_HISTORY, { ownerUid: ownerUid, sid: sid, identity: identity }, true, cb, true);
    };

    /**
     * Send message for get all channel online members
     *
     * @param users
     */
    this.getUserOnlineList = (users) => {
        if (users && users.length > 0) {
            sendMessage(CONST_IS_USERS_ONLINE, users, true);
        }
    };

    /**
     *
     * @param data
     * @returns {null}
     */
    function userListOnline(data) {
        if (!data || !data.message)
            return null;

        let users = data.message;

        if (Object.keys(users).length > 0) {
            self.afterUserOnlineReceived(users);
        }
    }

    function userOpenedGift(data) {
        if (!data || !data.message)
            return null;

        self.afterUserOpenedGift(data.message);
    }

    /**
     * After user open gift action
     * @param message
     */
    this.afterUserOpenedGift = function (message) {};

    /**
     * Event. After get list of online users
     * @param users
     */
    this.afterUserOnlineReceived = function (users) {};

    /**
     * Event. After get list of channels in a first time
     */
    this.afterChannelListGet = function(channels) {};

    /**
     * Event after socket reconnect
     */
    this.afterReconnect = function () {};

    /**
     * Get channel by member uid
     *
     * @param params
     * @param cb
     */
    this.getMemberChannel = function (params, cb) {
        if (!params) {
            throw new Error('getMemberChannel: member params is required.');
        }

        if (!cb && typeof cb !== 'function') {
            throw new Error('getMemberChannel: callback function is required.');
        }

        sendMessage(CONST_GET_MEMBER_CHANNEL, params, true, cb);
    };

    /**
     * Get channel by member uid
     *
     * @param uid
     * @param cb
     */
    this.getMemberChannelIfExist = function (uid, cb) {
        if (!uid) {
            throw new Error('getMemberChannelIfExist: member uid is required.');
        }

        if (!cb && typeof cb !== 'function') {
            throw new Error('getMemberChannelIfExist: callback function is required.');
        }

        log('Get member channel');

        if (typeof Members[uid] !== 'undefined' && typeof Members[uid].channel !== 'undefined') {
            cb(Members[uid].channel);
            return;
        }

        sendMessage(CONST_GET_MEMBER_CHANNEL_IF_EXIST, { uid: uid }, true, cb);
    };

    /**
     * Get channel by member uid
     *
     * @param cb
     * @param ownerUid
     * @param token
     * @param filters
     * @param settings
     */
    this.getMoreChannels = function (cb, token, ownerUid, filters, settings) {
        if (!cb && typeof cb !== 'function') {
            throw new Error('getMoreChannels: callback function is required.');
        }

        if (!ownerUid)
            throw new Error('getMoreChannels: ownerUid parameter is required.');

        var params = {};

        if (filters) {
            if (typeof filters.username !== 'undefined' && filters.username.length > 0)
                params.username = filters.username;

            if (typeof filters.uid !== 'undefined' && filters.uid.length > 0)
                params.uid = filters.uid;

            if (typeof filters.favorite !== 'undefined' && filters.favorite)
                params.favorite = filters.favorite;

            if (typeof filters.unAnswered !== 'undefined' && filters.unAnswered) {
                params.unAnswered = filters.unAnswered;
            }
        }

        if (settings)
            params.settings = settings;

        log('Get more channel');

        if (token) {
            params.token = token;
            params.ownerUid = ownerUid;
            log('Load more chats');
            sendMessage(CONST_GET_MORE_CHANNELS, params, true, cb, true);
            return;
        }

        cb([], null);
    };

    /**
     * Get more messages
     *
     * @param ownerUid
     * @param identity
     * @param index
     * @param cb
     */
    this.getMoreMessages = function (ownerUid, identity, index, cb) {
        if (!cb && typeof cb !== 'function') {
            throw new Error('getMoreMessages: callback function is required.');
        }

        if (!identity)
            throw new Error('getMoreMessages: parameter "identity" is required.');

        if (!ownerUid)
            throw new Error('getMoreMessages: parameter "ownerUid" is required.');

        if (!index)
            throw new Error('getMoreMessages: parameter "index" is required.');

            sendMessage(CONST_GET_MORE_MESSAGES, { ownerUid: ownerUid, identity: identity, token: index }, true, cb, true);
    };

    this.isStickerAvailable = function (params, cb) {
        sendMessage(CONST_CLIENT_SEND_STICKER_IS_AVAILABLE, params, true, cb, true);
    };

    /**
     * Get favourite channels count
     *
     * @param ownerUid
     * @param cb
     */
    this.getFavouriteChannelsCount = function (ownerUid, cb) {
        if (!cb || typeof cb !== 'function') {
            throw new Error('getFavouriteChannelsCount: callback function is required.');
        }

        if (!ownerUid) {
            throw new Error('getFavouriteChannelsCount: property "ownerUid" required.');
        }

        sendMessage(CONST_GET_FAVORITES_COUNT, { ownerUid: ownerUid }, true, cb, true);

    };

    function stickerAvailable(message) {
        if (!message.message) {
            return;
        }

        self.afterStickerAvailable(message.message);
    }

    function receivedCountOfNewTask(message) {
        if (!message.message) {
            return;
        }
        self.afterReceivedCountOfNewTask(message.message);
    }

    function taskFinished(message) {
        if (!message.message) {
            return;
        }
        self.afterTaskFinished(message.message);
    }

    function receivedNewTask(message) {
        if (!message.message) {
            return;
        }
        self.afterReceivedNewTask(message.message);
    }

    function receivedNewTask(message) {
        if (!message.message) {
            return;
        }
        self.afterReceivedNewTask(message.message);
    }

    function receivedUpdatedTasks(message) {
        if (!message.message) {
            return;
        }
        self.afterReceivedUpdatedTasks(message.message);
    }

    /**
     * Event if connection error
     */
    this.connectionError = function () {};

    this.afterStickerAvailable = function (message) {};

    this.afterReceivedCountOfNewTask = function (message) {};

    this.afterTaskFinished = function (message) {};

    this.afterReceivedNewTask = function (message) {};

    this.afterReceivedUpdatedTasks = function (message) {};

    /**
     * Get temporary identity of new channel
     *
     * @param members
     * @returns {*}
     */
    this.getTemporaryChannelIdentity = function (members) {
        members.sort((a, b) => {return a - b});

        return members.join(CONST_IDENTITY_SEPARATOR);
    };

    /**
     * Event after client join in new channel
     * @param channel
     */
    this.joinNewChannel = function (channel) {};

    /**
     * Event after channel was updated
     * @param channel
     */
    this.afterChannelUpdate = function (channel) {};

    /**
     * Event after received favourites count
     * @param message
     */
    this.afterReceiveFavouritesCount = function (message) {};

    /**
     * Send a notification to the server indicating that this Client is currently typing
     *
     * @param identity
     * @param opponent
     * @param user
     */
    this.typing = function (identity, opponent, user) {
        if (getChannel(identity) && typingTimeout === null) {
            typingTimeout = true;

            sendMessage(CONST_MEMBER_TYPING, { identity: identity, opponent: opponent , user: user });

            setTimeout(function () {
                typingTimeout = null;
            }, TYPING_INTERVAL);
        }
    };

    /**
     * Event after member start typing message into channel
     *
     * @param channel
     * @param member
     */
    this.typingStart = function (channel, member) {};

    /**
     * Event after member finish typing message into channel
     *
     * @param channel
     * @param member
     */
    this.typingEnd = function (channel, member) {};

    /**
     * Send new message to user
     *
     * @param ownerUid
     * @param identity
     * @param type
     * @param message
     * @param media
     * @param gift
     * @param sticker
     * @param tempKey
     * @param cb
     */
    this.sendNewMessage = function (ownerUid, identity, type, message, media, gift, sticker, tempKey, cb) {
        if (!cb && typeof cb !== 'function') {
            throw new Error('sendNewMessage: callback function is required.');
        }

        sendUserMessage(ownerUid, identity, type, message, media, gift, sticker, tempKey, cb);
    };

    /**
     * Update exist message
     *
     * @param ownerUid
     * @param identity
     * @param message
     * @param body
     * @param media
     * @param cb
     */
    this.updateMessage = function (ownerUid, identity, message, body, media, cb) {
        if (!cb && typeof cb !== 'function') {
            throw new Error('updateMessage: callback function is required.');
        }

        updateMessagePrivate(ownerUid, identity, message, body, media, cb);
    };

    /**
     * Update favorite status
     *
     * @param ownerUid
     * @param identity
     * @param status
     * @param cb
     */
    this.toggleFavorite = function (ownerUid, identity, status, cb) {
        if (!cb && typeof cb !== 'function') {
            throw new Error('updateMessage: callback function is required.');
        }

        toggleFavoritePrivate(ownerUid, identity, status, cb);
    };

    /**
     * Event after message was delivered to channel member
     *
     * @param channel
     * @param data
     */
    this.messageDelivered = function (channel, data) {};

    /**
     * Event emmit after message was not delivered or was broken
     *
     * @param channel
     * @param message
     * @param error
     * @param temp
     */
    this.messageDeliveredError = function (channel, message, error, temp) {};

    /**
     * Get message temporary key
     *
     * @param identity
     * @returns {string}
     */
    this.getMessageTempKey = function(identity) {
        return CONST_NEW_USER_MESSAGE + '-' + identity + '-' + microtime(true) + '-' +random(1, 500);
    };

    /**
     * Event after new message was add
     * @param channel
     * @param message
     */
    this.afterNewMessage = function (channel, message) {};

    /**
     * Send last consume message index
     *
     * @param identity
     * @param index
     */
    this.lastConsumeIndex = function (identity, index) {
        consumeMessage(identity, index);
    };

    /**
     * Event after message update
     * @param channel
     * @param message
     */
    this.afterMessageUpdate = function (channel, message) {};

    /**
     * Is socket connected
     * @returns {*}
     */
    this.isConnected = function () {
        return connected;
    };

    /**
     * Event after message was deleted
     * @param identity
     * @param sid
     * @param message
     */
    this.afterMessageDelete = function (identity, sid, message) {};

    /**
     * Event after client received update message error
     *
     * @param error
     * @param message
     */
    this.afterUpdateMessageError = function (error, message) {};

    /**
     * Get channel shared files
     *
     * @param ownerUid
     * @param identity
     * @param token
     * @param cb
     */
    this.getChannelFiles = function (ownerUid, identity, token, cb) {
        if (!cb && typeof cb !== 'function') {
            throw new Error('getChannelFiles: callback function is required.');
        }

        if (!ownerUid) {
            throw new Error('getChannelFiles: ownerUid parameter is required.');
        }

        if (!identity) {
            throw new Error('getChannelFiles: identity parameter is required.');
        }

        getChannelFilesPrivate(ownerUid, identity, token, cb);
    };

    /**
     * Event after received message with shared files error
     *
     * @param identity
     * @param error
     */
    this.afterMessageSharedError = function(identity, error) {};

    /**
     * Event after received new channel shared media
     *
     * @param identity
     * @param file
     */
    this.afterReceivedNewMedia = function(identity, file) {};

    /**
     * Event after channel was deleted
     *
     * @param identity
     */
    this.afterChannelDeleted = function (identity) {};

    /**
     * Event after channel was banned
     *
     * @param {identity:*, uid: *, importUid: *} data
     */
    this.afterChannelBaned = function (data) {};

    /**
     * User become online
     *
     * @param uid
     */
    this.afterUserBecomeOnline = function (uid) {};

    /**
     * User become online
     *
     * @param uid
     */
    this.afterUserBecomeOffline = function (uid) {};

    /**
     * Event when client get channel updates after reconnect
     *
     * @param channel
     */
    this.updatesAfterReconnect = function (channel) {};

    /**
     * Event after user was updated
     * @param user
     */
    this.afterUserUpdate = function(user) {};

    /**
     * Event after member was updated
     * @param user
     * @param identity
     */
    this.afterMemberUpdate = function(identity, user) {};

    /**
     * Event after count of unread messages received
     * @param count
     */
    this.afterCountNewMessageReceived = function(count) {};

    /**
     * Event after count of unread messages received
     * @param count
     */
    this.afterCountNewModelMessageReceived = function(count) {};

    /**
     * Get count of new messages for model profile
     *
     * @param settings
     */
    this.getCountModelsNewMessages = function (settings) {
        getCountNewMessages(settings);
    };

    /**
     * Close socket connection by client
     */
    this.closeConnection = function () {
        closeConnection();
    };

    /**
     * Close socket connection finally by client
     */
    this.closeConnectionFinally = function () {
        if (connected)
            SocketIo.close();
    };

    /**
     * Get newbie messages
     *
     * @param ownerUid
     * @param identity
     * @param token
     */
    this.getNewbieMedia = function (ownerUid, identity, token) {
        if (!ownerUid) {
            throw new Error('getNewbieMedia: ownerUid parameter is required.');
        }

        if (!identity) {
            throw new Error('getNewbieMedia: identity parameter is required.');
        }

        if (!token) {
            throw new Error('getNewbieMedia: token parameter is required.');
        }

        getChannelNewbieMedia(ownerUid, identity, token);
    };

    /**
     * Event after receive message history
     *
     * @param data
     */
    this.afterReceiveMessageHistory = function(data) {};

    /**
     * Open disappearing media
     * @param {string} identity
     * @param {number} ownerUid
     * @param {string} channelSid
     * @param {string} messageSid
     * @param {string} mediaSid
     * @param {function} cb
     */
    this.openDisappearingMedia = function (identity, ownerUid, channelSid, messageSid, mediaSid, cb) {
        sendMessage(
            CONST_OPEN_DISAPPEARED_MEDIA,
            {identity: identity, ownerUid: ownerUid, channelId: channelSid, messageId: messageSid, mediaId: mediaSid},
            true,
            cb,
            true
        );
    };

    /**
     * Check is available disappearing media
     * @param {string} identity
     * @param {number} ownerUid
     * @param {function} cb
     */
    this.isAvailableDisappearingMedia = function (identity, ownerUid, cb) {
        sendMessage(
            CONST_IS_AVAILABLE_DISAPPEARED_MEDIA,
            {identity: identity, ownerUid: ownerUid},
            true,
            cb,
            true
        );
    };

    /**
     * Get count of new tasks for model profile
     * @param {function} cb
     */
    this.getCountNewTask = function (cb) {
        sendMessage(
            CONST_GET_COUNT_NEW_TASK,
            null,
            true,
            cb,
            true
        );
    };

    /**
     * Get list of tasks for model profile
     * @param {Object} data
     * @param {function} cb
     */
    this.getTasksList = function (data, cb) {
        sendMessage(
            CONST_GET_TASKS_LIST,
            data,
            true,
            cb,
            true
        );

    };

    /**
     * Get task by identity
     * @param {Array<string>} identities
     * @param {function} cb
     */
    this.getTaskByChannelIdentity = function (identities, cb) {
        sendMessage(
            CONST_GET_TASKS_BY_IDENTITIES,
            { identities: identities },
            true,
            cb,
            true
        );
    };

    /**
     * Get task by identity
     * @param {Object} params
     * @param {function} cb
     */
    this.skipTask = function (params, cb) {
        sendMessage(
            CONST_SKIP_TASK,
            params,
            true,
            cb,
            true
        );
    };
}
