// 1. Text strings =====================================================================================================
//    Modify these strings and messages to change the behavior of your Lambda function

var languageStrings = {
    'de-DE': {
        'translation': {
            'WELCOME': "Willkommen beim daily standup meeting. Füge neue Mitglieder hinzu oder sage mir wer heute nicht da ist. Starte das Standup meeting wenn du fertig bist!",
            'HELP': "Füge Teammitglieder hinzu, lösche Teammitglieder oder starte das Standup meeting. ",
            'STOP': "Okay bis morgen",
            'UNHANDLED': "Ich verstehe das nicht.",
            'SID_ISPARTOFTHETEAM': " ist jetzt Teil des Teams. ",
            'SID_ADDMOREMEMBERSORSTART': "Starte das Standup Meeting oder füge weitere Mitglieder hinzu. ",
            'SID_ADDMOREMEMBERS': "Füge weitere Teammitglieder hinzu.",
            'SID_RESETSUCCESS': "Alle Teammitglieder wurden gelöscht.",
            'SID_EMPTYTEAM': "Du hast noch keine Mitglieder dem Team hinzugefügt.",
            'SID_TELLTEAMNAMES': "In deinem Team sind: "
        }
    }
    // , 'de-DE': { 'translation' : { 'TITLE'   : "Local Helfer etc." } }
};

var states = {
    ADDEDMODE: '_ADDEDMODE',
    DELETEDMODE: '_DELETEDEMODE',
    DEFAULTMODE: '_DEFAULTMODE',
    NAMEMODE: '_NAMEMODE'
};

// 2. Skill Code =======================================================================================================

var Alexa = require('alexa-sdk');

exports.handler = function (event, context, callback) {
    var alexa = Alexa.handler(event, context);

    alexa.appId = 'amzn1.ask.skill.81918edf-c069-4f5f-9244-0f59841ce570';
    alexa.dynamoDBTableName = 'memberNameTable'; // creates new table for session.attributes
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'ChooseStarterIntent': function () {
        console.log('Attributes is ');
        console.log(this.attributes['members']);
        if (this.attributes['members']) {
            if (this.attributes['members'].length > 1) {
                startStandup.call(this, this.attributes['members']);
            } else {
            var say = this.t('WELCOME');
            this.emit(':ask', 'Füge noch weitere Mitglieder hinzu');
            }
        } else {
            // Check if it's the first time the skill has been invoked
            this.attributes['members'] = [];
            console.log('ChooseStarterIntent first start')
        }
    },
    
    'Unhandled_ADDEDMODE': function () {
        this.emit(':tell', 'Unerwartet hinzufügenModus');
    },

    'AddNewMemberIntent': function () {
        if (this.event.request.dialogState !== 'COMPLETED'){
            this.emit(':delegate');
        } else if (this.event.request.intent.confirmationStatus === 'DENIED') {
            this.emit(':ask', 'Probiere es noch einmal.');
        }
        var name = 'Platzhalter';
        if (this.event.request.intent.slots.memberName.value) {
            name = this.event.request.intent.slots.memberName.value;
        }
        var say = name + this.t('SID_ISPARTOFTHETEAM');
        if (this.attributes['members'].length === 0) {
            say = say + this.t('SID_ADDMOREMEMBERS');
        } else {
            say = say + this.t('SID_ADDMOREMEMBERSORSTART');
        }
        
        console.log(Object.keys(this.attributes));
        console.log(this.attributes['members']);
        this.attributes['members'].push(name);
        this.emit(':saveState', true);
        this.emit(':ask', say);
        
    },
    
    'DeleteMemberIntent': function () {
        var name = 'Platzhalter';
        if (this.event.request.dialogState !== 'COMPLETED'){
            this.emit(':delegate');
        } else if (this.event.request.intent.confirmationStatus === 'DENIED') {
            this.emit(':ask', 'Probiere es noch einmal.');
        }
        if (this.event.request.intent.slots.memberName.value) {
            name = this.event.request.intent.slots.memberName.value;
        }
        if (this.attributes['members'].indexOf(name) !== -1) {
            this.attributes.members.splice(this.attributes.members.indexOf(name), 1);
            var say = 'Ok, ich werde ' + name + ' nicht mehr berücksichtigen. Starte das Standup Meeting oder lösche weitere Mitglieder. ';
            this.emit(':ask', say);
        } else {
            this.emit(':tell', 'Ich habe ' + name + 'nicht in deinem Team gefunden.')
        }
    },
    
    'LaunchRequest': function() {
        if(Object.keys(this.attributes).length === 0) { // Check if it's the first time the skill has been invoked
            this.attributes.members = [];
            console.log("First start from launch");
        }
		this.emit(":ask", this.t('WELCOME'));
	},
	
	'ResetIntent': function () {
	   if (this.event.request.dialogState !== 'COMPLETED'){
            this.emit(':delegate');
        } else if (this.event.request.intent.confirmationStatus === 'DENIED') {
            this.emit(':ask', this.t('HELP'));
        }
	    this.attributes.members = [];
	    this.emit(':tell', this.t('SID_RESETSUCCESS'));
	},
	
	'FullTeamIntent': function () {
	    var say = '';
	    if (this.attributes['members'].length === 0) {
            say = say + this.t('SID_EMPTYTEAM');
        } else {
            say = say + this.t('SID_TELLTEAMNAMES');
            for (var i in this.attributes.members) {
                say = say + this.attributes.members[i] + ". ";
            }
        }
	    this.emit(':tell', say);
	},

    'Unhandled': function () {
        this.emit(':tell', this.t('UNHANDLED'));
    },

    'AMAZON.YesIntent': function () {
        if (this.handler.state !== states.DEFAULTMODE) {
            this.emit(':tell', this.t('UNHANDLED'));
        } else {
            this.emit(':tell', this.t('HELP'));
        }
    },
    
    'AMAZON.YesIntent_ADDEDMODE': function () {
        this.handler.state = states.NAMEMODE;
        this.emit(':ask', this.t('SAYANAME'));
    },

    'AMAZON.NoIntent': function () {
        this.emit(':tell', this.t('UNHANDLED'));
    },
    'AMAZON.HelpIntent': function () {
        this.emit(':ask', this.t('HELP'));
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('STOP'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('STOP'));
    }

};

//    END of Intent Handlers {} ========================================================================================
// 3. Helper Function  =================================================================================================

function startStandup(members) {
    let startName = randomArrayElement(members);
    let say = startName + ' fängt heute an. Denke daran: Was hast du gestern gemacht, was nimmst du dir für heute vor und was blockiert dich, um das Sprint Ziel zu erreichen.';
    this.emit(':tell', say);
}

function randomArrayElement(array) {
    let i = Math.floor(Math.random() * array.length);
    return (array[i]);
}
