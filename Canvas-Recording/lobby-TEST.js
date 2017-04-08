/////////////////////////////////////////////////////////
//////////////////////   UI Code   //////////////////////
/////////////////////////////////////////////////////////
document.getElementById('btn-become-admin').onclick = function() {
  disableInputButtons();
  connection.adminId = document.getElementById('admin-id').value;
  connection.socketCustomEvent = connection.adminId;
  connection.checkPresence(connection.adminId, function(isAdminOnline, adminId, adminInfo) {
    if(isAdminOnline) {
      rmcNotificationBox('Multiple admins are NOT allowed. An admin is using same "admin-id".', {
        btnClose: false,
        btnAccept: false,
        btnAcceptText: '',
        onBtnAcceptClicked: function() {},
        autoClose: true,
        autoCloseInterval: 5 * 1000
      });
      return;
    }
    connection.open(connection.adminId, function() {
      showRoomURL(connection.sessionid);
    });
    handleSocketCustomMessages();
  });
};

document.getElementById('btn-become-guest').onclick = function() {
  disableInputButtons();
  connection.adminId = document.getElementById('admin-id').value;
  connection.socketCustomEvent = connection.adminId;
  connection.checkPresence(connection.adminId, function(isAdminOnline, adminId, adminInfo) {
    handleSocketCustomMessages();
    if (!isAdminOnline) {
      rmcNotificationBox('Admin seems offline.', {
        btnClose: true,
        btnAccept: false,
        btnAcceptText: '',
        onBtnAcceptClicked: function() {},
        autoClose: true,
        autoCloseInterval: 5 * 1000
      });
      return;
    }
    if (adminInfo.adminBusy) {
      rmcNotificationBox('Admin seems online however his status is showing "busy".', {
        btnClose: true,
        btnAccept: false,
        btnAcceptText: '',
        onBtnAcceptClicked: function() {},
        autoClose: true,
        autoCloseInterval: 5 * 1000
      });
      return;
    }
    rmcNotificationBox('Admin is online. You can join him. He seems "available" as well.', {
      btnClose: true,
      btnAccept: true,
      btnAcceptText: 'Join Admin',
      onBtnAcceptClicked: function() {
        connection.sendCustomMessage({
          messageFor: adminId,
          newGuest: true,
          guestId: connection.userid,
          guestInfo: connection.extra
        });
      },
      autoClose: false,
      autoCloseInterval: 2 * 1000
    });
  });
};

var notificationBox = document.getElementById('notification-box');
var notificationText = document.getElementById('notification-text');
var btnNotificationClose = document.getElementById('btn-notification-close');
var btnNotificationAccept = document.getElementById('btn-notification-accept');
var rmcNotificationBox = function(text, config) {
  notificationText.innerHTML = text;
  notificationBox.style.display = 'block';
  if (config.btnClose && config.btnClose === true) {
    btnNotificationClose.style.display = 'inline-block';
  } else {
    btnNotificationClose.style.display = 'none';
  }

  if (config.btnAccept && config.btnAccept === true) {
    btnNotificationAccept.style.display = 'inline-block';
  } else {
    btnNotificationAccept.style.display = 'none';
  }

  if (config.btnAcceptText && config.btnAcceptText.length) {
    btnNotificationAccept.innerHTML = config.btnAcceptText;
  } else {
    btnNotificationAccept.innerHTML = 'Accept';
  }

  if (config.autoClose) {
    setTimeout(function() {
      notificationBox.style.display = 'none';
    }, config.autoCloseInterval || 5 * 1000);
  }
  btnNotificationClose.onclick = function() {
    notificationBox.style.display = 'none';
  };
  btnNotificationAccept.onclick = function() {
    notificationBox.style.display = 'none';
    if (config.onBtnAcceptClicked && typeof config.onBtnAcceptClicked === 'function') {
      config.onBtnAcceptClicked();
    }
  };
};

/////////////////////////////////////////////////////////////////////////
//////////////////////   RTCMultiConnection Code   //////////////////////
/////////////////////////////////////////////////////////////////////////
var connection = new RTCMultiConnection();
// by default, socket.io server is assumed to be deployed on your own URL
connection.socketURL = '/';
// comment-out below line if you do not have your own socket.io server
connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
connection.socketMessageEvent = 'admin-guest-demo';
connection.enableFileSharing = true; // by default, it is "false".
connection.session = {
  audio: true,
  video: true,
  data: true
};
connection.sdpConstraints.mandatory = {
  OfferToReceiveAudio: true,
  OfferToReceiveVideo: true
};
connection.videosContainer = document.getElementById('videos-container');
connection.onstream = function(event) {
  connection.videosContainer.appendChild(event.mediaElement);
  event.mediaElement.play();
  setTimeout(function() {
    event.mediaElement.play();
  }, 5000);
};
connection.onmessage = appendDIV;
connection.filesContainer = document.getElementById('file-container');
connection.onopen = function() {
  document.getElementById('share-file').disabled = false;
  document.getElementById('input-text-chat').disabled = false;
  document.querySelector('h1').innerHTML = 'You are connected with: ' + connection.getAllParticipants().join(', ');
};
connection.onclose = function() {
  if (connection.getAllParticipants().length) {
    document.querySelector('h1').innerHTML = 'You are still connected with: ' + connection.getAllParticipants().join(', ');
  } else {
    document.querySelector('h1').innerHTML = 'Seems session has been closed or all participants left.';
  }
};
connection.___updateExtraData = connection.updateExtraData;
connection.updateExtraData = function() {
  connection.___updateExtraData();
  connection.sendCustomMessage({
    updatedExtraData: true,
    adminId: connection.userid,
    extra: connection.extra
  });
};
connection.onNewParticipant = function(participantId, userPreferences) {
  if (connection.userid === connection.adminId && !connection.extra.adminBusy) {
    connection.connectedGuestId = participantId;
    connection.extra.adminBusy = true;
    connection.updateExtraData();
    connection.acceptParticipationRequest(participantId, userPreferences);
  }
};
connection.onleave = function(event) {
  if (event.userid === connection.connectedGuestId) {
    connection.connectedGuestId = null;
    connection.extra.adminBusy = false;
    connection.updateExtraData();
  }
};
connection.sendCustomMessage = function(message) {
  if (!connection.socket) {
    connection.connectSocket();
  }
  connection.socket.emit(connection.socketCustomEvent, message);
};
connection.onExtraDataUpdated = function(event) {
  if (connection.userid === connection.adminId) {
    return;
  }
  if (event.userid === connection.adminId && event.extra.adminBusy === false) {
    notificationBox.style.display = 'none';
  }
  if (connection.getAllParticipants().length) {
    return;
  }
  if (event.userid === connection.adminId && event.extra.adminBusy === false) {
    rmcNotificationBox('Admin is online. You can join him. He seems "available" as well.', {
      btnClose: true,
      btnAccept: true,
      btnAcceptText: 'Join Admin',
      onBtnAcceptClicked: function() {
          connection.sendCustomMessage({
              messageFor: event.userid,
              newGuest: true,
              guestId: connection.userid,
              guestInfo: connection.extra
          });
      },
      autoClose: false,
      autoCloseInterval: 2 * 1000
    });
  }
};
var handleSocketCustomMessages = function() {
  if (!connection.socket) {
    connection.connectSocket();
  }
  connection.socket.on(connection.socketCustomEvent, function(message) {
    if (message.updatedExtraData && message.adminId === connection.adminId) {
      connection.onExtraDataUpdated({
        userid: connection.adminId,
        extra: message.extra
      });
      return;
    }
    if (message.messageFor !== connection.userid) {
      return;
    }
    if (message.newGuest) {
      var text = 'A new guest asked you to join him.';
      text += '<br>Guest User-ID: ' + message.guestId;
      text += '<br>Guest Info: ' + JSON.stringify(message.guestInfo);
      rmcNotificationBox(text, {
        btnClose: true,
        btnAccept: true,
        btnAcceptText: 'Allow Guest to Join You',
        onBtnAcceptClicked: function() {
          connection.sendCustomMessage({
            messageFor: message.guestId,
            youCanJoinAdmin: true,
            adminId: connection.userid,
            adminInfo: connection.extra
          });
        },
        autoClose: false,
        autoCloseInterval: 2 * 1000
      });
      return;
    }
    if (message.youCanJoinAdmin) {
      connection.join(message.adminId);
      var text = 'Admin accepted your request. Setting WebRTC connection...';
      rmcNotificationBox(text, {
        btnClose: false,
        btnAccept: false,
        btnAcceptText: '',
        onBtnAcceptClicked: function() {},
        autoClose: true,
        autoCloseInterval: 2 * 1000
      });
      return;
    }
  });
};
var disableInputButtons = function() {
  document.getElementById('btn-become-admin').disabled = true;
  document.getElementById('btn-become-guest').disabled = true;
  document.getElementById('admin-id').disabled = true;
};

///////////////////////////////////////////////////////////////
/////////////////////  HANDLING ADMIN-ID  /////////////////////
///////////////////////////////////////////////////////////////
var showRoomURL = function(adminId) {
  var roomHashURL = '#' + adminId;
  var roomQueryStringURL = '?adminId=' + adminId;
  var html = '<h2>Unique URL for your room:</h2><br>';
  html += 'Hash URL: <a href="' + roomHashURL + '" target="_blank">' + roomHashURL + '</a>';
  html += '<br>';
  html += 'QueryString URL: <a href="' + roomQueryStringURL + '" target="_blank">' + roomQueryStringURL + '</a>';
  var roomURLsDiv = document.getElementById('room-urls');
  roomURLsDiv.innerHTML = html;
  roomURLsDiv.style.display = 'block';
};

(function() {
  var params = {};
  var r = /([^&=]+)=?([^&]*)/g;
  var d = function(s) {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  };
  var match;
  var search = window.location.search;
  while (match = r.exec(search.substring(1))) {
    params[d(match[1])] = d(match[2]);
  }
  window.params = params;
})();

var adminId = '';

if (localStorage.getItem(connection.socketMessageEvent)) {
  adminId = localStorage.getItem(connection.socketMessageEvent);
} else {
  adminId = connection.token();
}

document.getElementById('admin-id').value = adminId;
document.getElementById('admin-id').onkeyup = function() {
  localStorage.setItem(connection.socketMessageEvent, this.value);
};

var hashString = location.hash.replace('#', '');

if (hashString.length && hashString.indexOf('comment-') === 0) {
  hashString = '';
}
var adminId = params.adminId;
if (!adminId && hashString.length) {
  adminId = hashString;
}
if (adminId && adminId.length) {
  document.getElementById('admin-id').value = adminId;
  localStorage.setItem(connection.socketMessageEvent, adminId);
  disableInputButtons();
  document.getElementById('btn-become-guest').onclick();
}