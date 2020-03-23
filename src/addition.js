///////////////////
// ENVIRONMENT PREP
///////////////////

// Turn on autowatch.
autowatch = 1;

// Post update to console whenever changes are saved.
post("addition.js updated.");
post();

// Set number of inlets and outlets.
inlets = 1;
outlets = 2;

// Set useful globals.
var MAX_VOICES = 8;
var DIM_LEVEL = 4;
var X_MIN = 0;
var X_MAX = 15;
var Y_MIN = 0;
var Y_MAX = 7;
var LED_MIN = 0;
var LED_MAX = 15;
var GRID_SET_MSG = "/monome/grid/led/set";
var GRID_LEVEL_MSG = "/monome/grid/led/level/set";

// Arrays to hold voice on/off state as well as gate on/off state. Initially they are all turned off.
var voice_on_state = [];
var voice_gate_state = [];
for (var i = 0; i < MAX_VOICES; i++) {
    voice_on_state.push(false);
    voice_gate_state.push(false);
}

// Array to track which voices are active where on the grid play area (i.e. everywere that's not the top control row). It get two extra initialization loops because it's a 3D array (Y_MAX - 1 rows x X_MAX cols x MAX_VOICES bools)

// var play_area_active_voices = new Array();
// for (var i = 0; i < Y_MAX; i++) {
//     play_area_active_voices[i] = new Array();
//     for (var j = 0; j <= X_MAX; j++) {
//         play_area_active_voices[i][j] = new Array();
//         for (var voice = 0; voice < MAX_VOICES; voice++) {
//             play_area_active_voices[i][j][voice] = false;
//         }
//     }
// }

// Array to track whether a given voice is active and if so, what grid x y coordinate and led value it has. Note that led 1 generally will correspond to a full brightness message rather than a varibright message. If there is no value associated with the voice, it will be set to false. We copy voice_on_state since it's also initialized to a vector of false values.
play_area_active_voices = voice_on_state.slice();


///////////////////////////////////////////////////////////////////////
// LIST METHOD FUNCTIONS "LIKE" A WHILE LOOP EMBEDED IN A MAIN FUNCTION
// PRIMARY PROGRAM LOGIC LIVES HERE
///////////////////////////////////////////////////////////////////////

function list() {
    // Listens for grid input messages with osc address pre-stripped.
    // Uses messages to generate control messages for oscillators and
    // grid lights. Oscillator control messages leave through left outlet, light messages leave through right outlet.
    
    // First we sanity check the input.

    // Abort if message is malformed.
    if (arguments.length != 3) {
        error("Grid messages must consist of three ints (x, y, led on/off OR level)");
        post();
    }

    // Convenience variables to make code more readable.
    x = arguments[0];
    y = arguments[1];
    led = arguments[2];

    // Abort if input is out of range.
    if (((x < X_MIN) || (x > X_MAX)) || ((y < Y_MIN) || (y > Y_MAX)) || (led < LED_MIN) || (led > LED_MAX)) {
        error("One or more grid input messages are out of range for the monome 128.");
        post();
    }

    // First we throw away note off messages from the grid since we are using it exclusively as a toggle board.
    if (led != 1) {
        return null;
    }
    
    // Check for control row (i.e. top row) messages.
    if (y == 0) {
        // Check to see if voice should turn on or off. Since only keys up to MAX_VOICES are reserved for this purpose, we can use another if test to do this.
        if (x < MAX_VOICES) {
            //post("on/off message received")
            //post();
            updateVoiceOnOffState(x);
        } else {
            // Alternative is that voice gate should turn on or off. MAX_VOICES is subtracted to convert the x value of the key into the corresponding voice since that constant is the offset.
            //post("gate message");
            //post();
            updateVoiceGateState(x - MAX_VOICES);
        }       
    } else {
        // Handle message from play area.
        //post("sending play area message");
        //post();
        // 1) check to see which voice gates are open
        // 2) translate grid input into grid light control messages and control messages for those voices
        for (var i = 0; i < MAX_VOICES; i++) {
            if (voice_gate_state[i] == true) {
                updatePlayArea(x, y, i);
            }
        }
    }
}


/////////////////////////////////////
// CONTROL ROW LOGIC HELPER FUNCTIONS
/////////////////////////////////////

function updateVoiceOnOffState(i) {
    // Updates the state of the ith voice when an On/Off message for that voice is received. If turning off, turns off voice gate as well.

    // First snag values of current play area location for convenience.
    play_area_x = play_area_active_voices[i][0];
    play_area_y = play_area_active_voices[i][1];
    
    post("toggling voice number: " + i);
    post();
    if (voice_on_state[i] == true) {
        // Turn off voice light
        outlet(1, gridLightOff(i, 0));
        // Turn off voice gate light
        outlet(1, gridLightOff(MAX_VOICES + i, 0));
        // Turn off play area light
        


        post("Turning off play area x y value: " + play_area_x + " " + play_area_y);
        post();


        
        outlet(1, gridLightOff(play_area_x, play_area_y));
        // Turn off the oscillator, clean up the gate status (i.e. disable incoming parameter messages), and set play area for voice i to false.
        outlet(0, oscillatorOff(i));
        outlet(0, gateOff(i));
        
        voice_on_state[i] = false;
        voice_gate_state[i] = false;

        // Might remove this since i want original location to reactivate when voice comes back on
        //play_area_active_voices[i] = false;
    } else {
        // Turn on voice light
        outlet(1, gridLightOn(i, 0));
        // Set voice gate light to dim
        outlet(1, gridLightLevel(MAX_VOICES + i, 0, DIM_LEVEL));
        // Turn on play area light to DIM since voice gate is off
        outlet(1, gridLightLevel(play_area_x, play_area_y, DIM_LEVEL));
        // Turn on the oscillator with gate status off as default.
        outlet(0, oscillatorOn(i));
        outlet(0, gateOff(i));

        voice_on_state[i] = true;
    }
}

function updateVoiceGateState(i) {
    // Updates the gate state of the ith voice but only if the voice is currently on.
    // First snag values of current play area location for convenience.
    play_area_x = play_area_active_voices[i][0];
    play_area_y = play_area_active_voices[i][1];
    if (voice_on_state[i] == false) {
        // Do nothing and return if voice i is currently off.
        return null;
    } else {
        if (voice_gate_state[i] == false) {
            // If the gate is off, turn it on. Set control voice light to full brightness as well as play area.
            post("turning on gate for voice " + i);
            post();
            outlet(1, gridLightOn(i + MAX_VOICES, 0));
            outlet(1, gridLightFlashOn(play_area_x, play_area_y));
            outlet(1, gridLightOn(play_area_x, play_area_y));
            outlet(0, gateOn(i));

            voice_gate_state[i] = true;
        } else {
            // The gate is on, turn it off. Set voice control light back to dim as well as play area light (but only if no other voices are in the same play area coordinate).
            post("turning off gate for voice " + i);
            outlet(1, gridLightLevel(i + MAX_VOICES, 0, DIM_LEVEL));
            
            outlet(0, gateOff(i));
            
            voice_gate_state[i] = false;

            // Now we check if any gated voices are remaining at the play area, and dim the key if not.
            if (!testKeyForGatedVoices(play_area_x, play_area_y)) {
                outlet(1, gridLightLevel(play_area_x, play_area_y, DIM_LEVEL));
            }
        }
    }   
}


///////////////////////////////////
// PLAY AREA LOGIC HELPER FUNCTIONS
///////////////////////////////////

function updatePlayArea(x, y, voice) {
    // Updates the state of the grid play area, and sends corresponding grid light + voice control messages.

    // Store old grid x, values for later. Wrapped in a try block in case there is not yet an x, y value stored in that voice.
    try {
        old_x = play_area_active_voices[voice][0];
        old_y = play_area_active_voices[voice][1];
        post("old play area values: " + old_x + " " + old_y);
    }

    catch (err) {
        post(err + ": " + "Updating voice with no previously assigned play area value.");
    }
    
    // 1) Handle update to current voice state + send voice control messages + new light update message




    post();
    post("Updated play area voice num " + voice + " from ");
    post(play_area_active_voices[voice][0] + " " + play_area_active_voices[voice][1] + " to");
    play_area_active_voices[voice] = [x, y, 1]; // (x, y, led ON)
    post(" " + play_area_active_voices[voice][0]);
    post(" " + play_area_active_voices[voice][1]);
    post();



    
    // Mapping x values to (multiples of 200) + 100
    outlet(0, sendFrequency(voice, x*200 + 100));
    // Mapping y values 1-7 to linear pan.
    outlet(0, sendPan(voice, (y - 4)/3.0));

    outlet(1, gridLightOn(x, y));
    
    // 2) Use ALL current voice states post-update to decide whether or not to turn off the play area light. This is only necessary however if we succeeded previously in getting old_x and old_y (i.e., if there was a light on for that voice at the old coordinates), so if those variables are undefined we short circuit the function instead.
    if (typeof old_x === 'undefined') {
        return null;
    } else {
        for (var i = 0; i < MAX_VOICES; i++) {
            // Test if ANY voices is active in the old position of the voice that was updated. IF so, short circuit with no update.
            if (testKeyForActiveVoices(old_x, old_y)) {
                return null;
            }
        }

        // No voices are left in the old position, so we turn out the light, pack up shop, and go on home,
        outlet(1, gridLightOff(old_x, old_y));
    }
}

function gateStatusPlayArea(voice) {
    // Toggles the brightness of play area lights corresponding to the argument voice. Light becomes dim when gate is off.
}

function testKeyForActiveVoices(x, y) {
    // Boolean to see if any currently on voices are set to the play area coordinate x, y.
    
    for (var i = 0; i < MAX_VOICES; i++) {
        if (voice_on_state[i] && (play_area_active_voices[i][0] == x) && (play_area_active_voices[i][1] == y)) {
            return true;
        }
    }

    return false;
}

function testKeyForGatedVoices(x, y) {
    // Boolean to see if any currently gated on voices are set to the play area coordinate x, y.
    
    for (var i = 0; i < MAX_VOICES; i++) {
        if (voice_gate_state[i] && (play_area_active_voices[i][0] == x) && (play_area_active_voices[i][1] == y)) {
            return true;
        }
    }

    return false;
}


//////////////////////////////////////
// MESSAGE GENERATION HELPER FUNCTIONS
//////////////////////////////////////

// MSGes TO GRID
// Functions to generate grid light messages.
function gridLightOn(x, y) {
    return [GRID_SET_MSG, x, y, 1];
}

function gridLightOff(x, y) {
    post("TESTESTEST");
    return [GRID_SET_MSG, x, y, 0];
}

function gridLightLevel(x, y, led) {
    return [GRID_LEVEL_MSG, x, y, led];
}

function gridLightFlashOn(x, y) {
    // Convenience function to flash a grid key several times. Helpful if there's the need to draw user attention to particular key first.
    var turn_on = new Task(gridLightOn, this, x, y);
    var turn_off = new Task(gridLightOff, this, x, y);

    //turn_on.interval = 50;
    //turn_off.interval = 25;
    //turn_off.repeat(3)
    //turn_off.repeat(4);
    turn_off.execute();
}

function bang() {
    msg = gridLightOn(0, 0);
    setGridLight(msg);
}

// PARAMETER CONTROL MSGes TO VOICES
function sendFrequency(i, freq) {
    // Updates the frequency of the ith oscillator.
    return [i, 'freq', freq];
}

function sendPan(i, pan) {
    // Updates the pan of the ith oscillator.
    // First a quick sanity check on the pan value.
    if (pan < -1 || pan > 1) {
        error("Pan with abs value > |1| encountered.");
        post();
    }

    return [i, 'pan', pan];
}

function oscillatorOn(i) {
    // Turns on the ith oscillator.
    return [i, 'on_off', 1]
}

function oscillatorOff(i) {
    // Turns off the ith oscillator.
    return [i, 'on_off', 0];
}

function gateOn(i) {
    // Opens the parameter input gate to the ith oscillator.
    return [i, 'gate', 1];
}

function gateOff(i) {
    // Closes the parameter input gate to the ith oscillator.
    return [i, 'gate', 0];
}


//////////////////
// DEBUG FUNCTIONS
//////////////////
