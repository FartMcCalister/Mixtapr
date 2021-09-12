$(document).ready(function(){
  $('#results').hide();
  $('#optimize').hide();
  
  /*document.getElementById('fileInput').addEventListener('change', function(){

    // Obtain the uploaded file, you can change the logic if you are working with multiupload
    var file = this.files[0];
    
    // Create instance of FileReader
    var reader = new FileReader();

    // When the file has been succesfully read
    reader.onload = function (event) {

      // Create an instance of AudioContext
      var audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Asynchronously decode audio file data contained in an ArrayBuffer.
      audioContext.decodeAudioData(event.target.result, function(buffer) {
        // Obtain the duration in seconds of the audio file (with milliseconds as well, a float value)
        var duration = buffer.duration;

        // example 12.3234 seconds
        //console.log("The duration of the song is " + duration + " seconds");
        // Alternatively, just display the integer value with
        // parseInt(duration)
        // 12 seconds
      });
    };

    // In case that the file couldn't be read
    reader.onerror = function (event) {
      console.error("An error ocurred reading the file: ", event);
    };

    // Read file as an ArrayBuffer, important !
    reader.readAsArrayBuffer(file);
  }, false);*/
  
  
  function Track (file) {
    this.file = file;
    this.name = file.name.replace(/\.[A-Za-z0-9]+$/, '');
    this.duration = 0.0;
    //this.title = "";
    
    populateMetaData(this);
  }
  
  var audioFiles = [];
  var secondsSideA = parseInt(($('#tapeType').val()*100) * 60 / 100) / 2;
  var secondsSideB = parseInt(($('#tapeType').val()*100) * 60 / 100) / 2;
  var secondsSilence = 0;
  var minimumSilence = 0.1;  // minimum 0.1s delay between songs for fixing timing inaccuracies
  var secondsPaddingStart = 0;
  var secondsPaddingEnd = 0;
  var solutionThreshold = 2;
  
  var bestSolution = new Solution();
  var ignoreStupidSolutions = true;
  var maxTrackCount = 0;
  var minTrackCount = 0;
  
  var audioElement = document.createElement('audio');
  var currentlyPlaying = -1;
  
  var isPlayingSide = false; // true when playing whole side
  var currentSide = "";      // A or B when playing a side, empty when not playing
  var currentTrack = 0;      // increments by 1 for each track played when playing whole side
  var currentFillWidth = 0;  // number of pixels for the width of the filled side being played now
  var startTime = 0;         // stores start time of playing side
  var sideA = [];            // list of tracks on side A
  var sideB = [];            // list of tracks on side B
  var sideTracks = [];       // set to list of current tracks (either A or B)
  var timesSideA = [];       // start times of tracks A
  var timesSideB = [];       // start times of tracks B
  var times = [];            // start times of current tracks (either A or B)
  var currentTimeOffset = 0; // difference in current position vs expected position, used to tweak wait times between songs
  var endTimeA = 0;          // seconds after start that side A should end
  var endTimeB = 0;          // seconds after start that side B should end
  var endTime = 0;           // seconds after start that played side should end
  
  
  // uploads all files selected in the file chooser
  // does not remove existing files
  // does not add duplicate files
  upload = function () {
    // clear list of files
    //audioFiles = [];
    
    var fileInput = $('#fileInput')[0];

    // files is a FileList object (similar to NodeList)
    var files = fileInput.files;

    // loop through files
    for (var i = 0; i < files.length; i++) {
      addFile(files[i]);
    }
    
    refreshDisplayedFiles();
  };
  
  // adds a file to the list if not already there
  addFile = function (file) {
	if(file.type.startsWith('audio/')) {
		console.log("Uploading: " + file.name);
    //if(file.type == "audio/wav" || file.type == "audio/mpeg" || file.type == "audio/flac" || file.type == "audio/x-flac") {
      if(!hasTrack(file)) {
        audioFiles.push(new Track(file));
      }
      else {
        console.log("Skipping upload of duplicate track: " + file.name);
      }
    }
  };
  
  // returns true if there is already a file in the list with the same file name
  hasTrack = function (file) {
    var found = false;
    $.each(audioFiles, function (i, data) {
      if(data.file.name == file.name) {
        found = true;
      }
    });
    return found;
  };
  
  // removes an uploaded track by index
  // hides solution
  // TODO: see if possible to preserve solution if removed track wasn't used
  removeTrack = function (index) {
    audioFiles.splice(index, 1);
    refreshDisplayedFiles();
    clearSolution();
    $('#results').hide();
  };
  
  // builds the list of files
  refreshDisplayedFiles = function () {
    $('#fileListSection').empty();
    var header = "<tr><th></th><th>Track Name</th><th>Duration</th><th></th><th></th></tr>";
    $('#fileListSection').append(header);
    
    var readyToOptimize = true;
    
    $.each(audioFiles, function (i, data) {
      if(data.duration == 0) {
        readyToOptimize = false;
      }
      var dur = formatTimeDecimal(data.duration);
      var remove = "<button class='xButton' onclick='removeTrack("+i+")'>X</button>";
      var row = "<tr><td id='control"+i+"'>"+buildPlayButtonImage(i)+"</td><td>"+data.name+"</td><td>"+dur+"</td><td>"+remove+"</td></tr>";
      $('#fileListSection').append(row);
    });
    
    if(audioFiles.length > 0 && readyToOptimize) {
      $('#optimize').show();
    }
    else {
      $('#optimize').hide();
    }
  };
  
  /*
  var optimizeCheck = setInterval(function () {
    if($('#fileListSection').is(':visible') && !isPlayingSide) {
      if(audioFiles.length > 0) {
        var uninitializedFiles = false;
        $.each(audioFiles, function (i, data) {
          if(data.duration == 0 || data.duration == null) {
            // some file not initialized yet
            uninitializedFiles = true;
          }
        });
        if(!uninitializedFiles) {
          // all files are initialized
          $('#optimize').show();
        }
        else {
          // at least one file not yet initialized
          $('#optimize').hide();
        }
      }
      else {
        // no files to optimize yet
        $('#optimize').hide();
      }
    }
  }, 1000);*/
  
  // common function to build the image button that changes from play to stop for each track
  buildPlayButtonImage = function (index) {
    return "<img src='play_button_green3.png' alt='play' onclick='clickPlayTrack("+index+");' style='padding-top:3px;width:15px;height:15px;'>";
  };
  
  // common function to build the image button that changes from play to stop for each track
  buildStopButtonImage = function (index) {
    return "<img src='stop_button_red3.png' alt='stop' onclick='clickStopPlaying();' style='padding-top:3px;width:15px;height:15px;'>";
  };
  
  buildUpArrowImage = function (index, invisible) {
    return "<img src='up_arrow3.png' alt='up' onclick='moveTrackUp("+index+")' style='padding-top:3px;width:15px;height:15px;"+(invisible?"opacity:0;":"")+"'>";
  };
  
  buildDownArrowImage = function (index, invisible) {
    return "<img src='down_arrow3.png' alt='up' onclick='moveTrackDown("+index+")' style='padding-top:3px;width:15px;height:15px;"+(invisible?"opacity:0;":"")+"'>";
  };
  
  populateMetaData = function (track) {
    // Create instance of FileReader
    var reader = new FileReader();

    // When the file has been succesfully read
    reader.onload = function (event) {

      // Create an instance of AudioContext
      var audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // Asynchronously decode audio file data contained in an ArrayBuffer.
      audioContext.decodeAudioData(event.target.result, function(buffer) {
        // Obtain the duration in seconds of the audio file (with milliseconds as well, a float value)
        var duration = buffer.duration;
        
        track.duration = duration;
        refreshDisplayedFiles();
        
        //var metadata = AudioMetadata.ogg(event.target.result);
        //track.title = metadata.title;
        //refreshDisplayedFiles();

        // example 12.3234 seconds
        // console.log("The duration of the song is " + duration + " seconds");
        // Alternatively, just display the integer value with
        // parseInt(duration)
        // 12 seconds
      });
    };
    
    // Read in the file which triggers the onload above
    reader.readAsArrayBuffer(track.file);
  };
  
  formatTime = function (seconds) {
    var pad = "";
    if(Math.round(seconds % 60) < 10) {
      pad = "0";
    }
    return Math.floor(seconds / 60) + ":" + pad + Math.round(seconds % 60);
  };
  
  formatTimeDecimal = function (seconds) {
    var pad = "";
    var decimalPad = "";
    var minutes = Math.floor(seconds / 60);
    var roundedSeconds = Math.round((seconds % 60) * 100)/100;
    if(roundedSeconds == 60) {
      roundedSeconds = 0;
      minutes++;
    }
    if(roundedSeconds < 10) {
      pad = "0";
    }
    var decimalLength = roundedSeconds.toString().replace(/^[0-9]+/, '').length;
    if(decimalLength == 0) {
      decimalPad = ".00";
    }
    else if(decimalLength == 2) {
      decimalPad = "0";
    }
    return minutes + ":" + pad + roundedSeconds + decimalPad;
  };
  
  ////////////////////////////////////
  //
  //       PLAYING TRACKS
  //
  ////////////////////////////////////
  
  // function to start playing a track by index
  playTrack = function (index) {
    stopPlaying();
    audioElement.remove();
    audioElement = document.createElement('audio');
    //audioElement.removeEventListener('ended', trackEnded(index), false);
    audioElement.setAttribute('src', URL.createObjectURL(audioFiles[index].file));
    audioElement.addEventListener('ended', function() {
      trackEnded(index);
    }, false);
    audioElement.play();
    $('#control'+index).html(buildStopButtonImage(index));
    currentlyPlaying = index;
  };
  
  // function called by clicking on play button for a specific track
  clickPlayTrack = function (index) {
    // don't allow click to play if currently playing whole side
    if(!isPlayingSide) {
      playTrack(index);
    }
  };
  
  stopPlaying = function () {
    if(currentlyPlaying > -1) {
      audioElement.pause();
      audioElement.currentTime = 0;
      $('#control'+currentlyPlaying).html(buildPlayButtonImage(currentlyPlaying));
      currentlyPlaying = -1;
      isPlayingSide = false;
    }
  };
  
  // function called by clicking on stop button for a specific track
  clickStopPlaying = function () {
    // don't allow click to stop if currently playing whole side
    if(!isPlayingSide) {
      stopPlaying();
    }
  };
  
  // call when a track ends to update button and stuff
  // TODO: will be used to trigger time wait and next playing track
  trackEnded = function (index) {
    if(currentlyPlaying == index) {
      console.log("track ended: " + index);
      $('#control'+index).html(buildPlayButtonImage(index));
      currentlyPlaying = -1;
      if(isPlayingSide) {
        currentTrack++;
        if(currentTrack >= sideTracks.length) {
          // just finished last track, don't wait for silence between tracks
          // call playNext immediately to initiate end of playing
          playNext();
        }
        else {
          // wait and then play the next track
          setTimeout(function() {
            playNext();
          }, Math.max((secondsSilence * 1000) - currentTimeOffset, 0));
        }
      }
    }
    else {
      console.log("leftover event listener that should have been removed");
      // leftover event listener that should have been removed
    }
  };
  
  playSideA = function () {
    if(!isPlayingSide && audioFiles.length > 0 && currentlyPlaying == -1) {
      console.log("playing side A with number of tracks: " + bestSolution.trackIdsA.length);
      currentSide = "A";
      sideTracks = bestSolution.trackIdsA;
      times = timesSideA;
      endTime = endTimeA;
      currentTrack = 0;
      currentTimeOffset = 0;
      currentFillWidth = parseInt($('#tapeFilledBarA').css("width").replace('px', ''));
      $('#playSideA').hide();
      $('#stopSideA').show();
      isPlayingSide = true;
      startTime = window.performance.now();
      //startTime = new Date();
      
      setTimeout(function() {
        playNext();
      }, secondsPaddingStart * 1000);
    }
  };
  
  playSideB = function () {
    if(!isPlayingSide && audioFiles.length > 0 && currentlyPlaying == -1) {
      console.log("playing side B with number of tracks: " + bestSolution.trackIdsB.length);
      currentSide = "B";
      sideTracks = bestSolution.trackIdsB;
      times = timesSideB;
      endTime = endTimeB;
      currentTrack = 0;
      currentTimeOffset = 0;
      currentFillWidth = parseInt($('#tapeFilledBarB').css("width").replace('px', ''));
      $('#playSideB').hide();
      $('#stopSideB').show();
      isPlayingSide = true;
      startTime = window.performance.now();
      
      setTimeout(function() {
        playNext();
      }, secondsPaddingStart * 1000);
    }
  };
  
  stopSideA = function () {
    stopPlayingSide();
  };
  
  stopSideB = function () {
    stopPlayingSide();
  };
  
  playNext = function () {
    if(isPlayingSide) {
      var currentTime = window.performance.now() - startTime;
      var expectedTime = times[currentTrack];
      var difference = currentTime - expectedTime;
      currentTimeOffset = difference;
      console.log("playing currentTrack: " + currentTrack + " of " + sideTracks.length);
      if(currentTrack < sideTracks.length) {
        console.log("playing track: " + audioFiles[sideTracks[currentTrack]].file.name);
        console.log("start time: " + currentTime + ", expected start time: " + times[currentTrack] + ", difference: " + difference);
        playTrack(sideTracks[currentTrack]);
      }
      else {
        // done playing, wait for end time
        console.log("done playing, waiting for end padding... currentTime: " + currentTime);
        setTimeout(function() {
          stopPlayingSide();
        }, secondsPaddingEnd * 1000);
      }
    }
  };
  
  stopPlayingSide = function () {
    if(isPlayingSide) {
      var currentTime = window.performance.now() - startTime;
      console.log("stopped playing at: " + currentTime);
      $('#control'+currentlyPlaying).html(buildPlayButtonImage(currentlyPlaying));
      isPlayingSide = false;
      currentSide = "";
      sideTracks = [];
      times = [];
      endTime = 0;
      currentTrack = 0;
      currentTimeOffset = 0;
      currentFillWidth = 0;
      $('#playSideA').show();
      $('#stopSideA').hide();
      $('#playSideB').show();
      $('#stopSideB').hide();
      audioElement.pause();
      audioElement.currentTime = 0;
      currentlyPlaying = -1;
      $('#timerA').text(formatTimeDecimal(0));
      $('#timerB').text(formatTimeDecimal(0));
      $('#tapePositionA').css('margin-left', '');
      $('#tapePositionB').css('margin-left', '');
    }
  };
  
  hideControlButtons = function () {
    $('#playSideA').hide();
    $('#stopSideA').hide();
    $('#playSideB').hide();
    $('#stopSideB').hide();
  };
  
  // update timer display
  var timerDisplay = setInterval(function () {
    if(isPlayingSide) {
      var currentTime = window.performance.now() - startTime;
      //console.log(currentTime);
      // don't allow displayed time to go higher than end time displayed for the side
      var displayTime = Math.min(currentTime/1000, endTime);
      $('#timer'+getSide()).text(formatTimeDecimal(displayTime));
      
      // update progress bar
      var percentDone = Math.min((currentTime/1000) / endTime, 1);
      $('#tapePosition'+getSide()).css('margin-left', percentDone * currentFillWidth);
    }
  }, 50);

  getSide = function () {
    if(isPlayingSide) {
      return currentSide;
    }
    return "";
  };
  
  moveTrackUp = function (index) {
    if(!isPlayingSide && index < audioFiles.length && bestSolution.trackIdsA.length > 0) {
      var moved = false;
      var trackPositionA = bestSolution.trackIdsA.indexOf(index);
      var trackPositionB = bestSolution.trackIdsB.indexOf(index);
      if(trackPositionA > 0) {
        // only move up if track is in list (not -1) and not the first element (not 0)
        
        // set current element (value is input index) to previous element value
        bestSolution.trackIdsA[trackPositionA] = bestSolution.trackIdsA[trackPositionA - 1];
        
        // set previous element value to input index
        bestSolution.trackIdsA[trackPositionA - 1] = index;
        
        moved = true;
      }
      else if(trackPositionB > 0) {
        bestSolution.trackIdsB[trackPositionB] = bestSolution.trackIdsB[trackPositionB - 1];
        bestSolution.trackIdsB[trackPositionB - 1] = index;
        moved = true;
      }
      
      if(moved) {
        displaySolution(bestSolution);
      }
    }
  };
  
  moveTrackDown = function (index) {
    if(!isPlayingSide && index < audioFiles.length && bestSolution.trackIdsA.length > 0) {
      var moved = false;
      var trackPositionA = bestSolution.trackIdsA.indexOf(index);
      var trackPositionB = bestSolution.trackIdsB.indexOf(index);
      if(trackPositionA > -1 && trackPositionA < bestSolution.trackIdsA.length - 1) {
        // only move down if track is in list (not -1) and not the last element (not length - 1)
        
        // set current element (value is input index) to next element value
        bestSolution.trackIdsA[trackPositionA] = bestSolution.trackIdsA[trackPositionA + 1];
        
        // set next element value to input index
        bestSolution.trackIdsA[trackPositionA + 1] = index;
        
        moved = true;
      }
      else if(trackPositionB > -1 && trackPositionB < bestSolution.trackIdsB.length - 1) {
        bestSolution.trackIdsB[trackPositionB] = bestSolution.trackIdsB[trackPositionB + 1];
        bestSolution.trackIdsB[trackPositionB + 1] = index;
        moved = true;
      }
      
      if(moved) {
        displaySolution(bestSolution);
      }
    }
  };
  
  
  ////////////////////////////////////
  //
  //       BRUTE FORCE LOGIC
  //
  ////////////////////////////////////
  
  // may want to add wasted time property
  function Solution () {
    this.trackIdsA = [];
    this.trackIdsB = [];
    this.duration = 0;
  }
  
  optimize = function () {
    if(audioFiles.length > 0) {
      secondsSideA = parseInt(($('#tapeType').val()*100) * 60 / 100) / 2;
	  console.log("secondsSideA: " + secondsSideA);
      secondsSideB = parseInt(($('#tapeType').val()*100) * 60 / 100) / 2;
	  console.log("secondsSideB: " + secondsSideB);
      secondsSilence = Math.max(parseInt($('#secondsSilence').val()), minimumSilence);
      secondsPaddingStart = parseInt($('#secondsPaddingStart').val());
      secondsPaddingEnd = parseInt($('#secondsPaddingEnd').val());
      maxTrackCount = getMaxTrackCount();
      minTrackCount = getMinTrackCount();
      solutionThreshold = parseInt($('#secondsThreshold').val());
      ignoreStupidSolutions = $('#stupidCheckbox').prop("checked");
      
      var maxSolutions = 0;
      var stupidSolutions = 0;
      
      if(minTrackCount == audioFiles.length) {
        // all tracks can fit on side 1
        bestSolution = getAllSolution();
      }
      else if(audioFiles.length > 20) {
        // too many solutions to try them all, using random mode
        maxSolutions = 1000000;
        bestSolution = getSolutionById(0);
        for(var i = 0; i < maxSolutions; i++) {
          var solutionId = Math.random() * Math.pow(2, audioFiles.length);
          if(!isStupidSolution(solutionId)) {
            var solution = getSolutionById(solutionId);
            if(solution.duration > bestSolution.duration && solution.duration <= secondsSideA) {
              bestSolution = solution;
              if(solution.duration >= secondsSideA - solutionThreshold) {
                console.log("stopping after " + i + " iterations out of " + maxSolutions);
                i = maxSolutions;
              }
            }
          }
          else {
            stupidSolutions++;
          }
        }
      }
      else {
        // brute forcing all solutions (up to 2^20=1048576 iterations)
        maxSolutions = Math.pow(2, audioFiles.length);
        bestSolution = getSolutionById(0);

        for(var i = 0; i < maxSolutions; i++) {
          if(!isStupidSolution(i)) {
            var solution = getSolutionById(i);
            if(solution.duration > bestSolution.duration && solution.duration <= secondsSideA) {
              bestSolution = solution;
              if(solution.duration >= secondsSideA - solutionThreshold) {
                console.log("stopping after " + i + " iterations out of " + maxSolutions);
                i = maxSolutions;
              }
            }
          }
          else {
            stupidSolutions++;
          }
        }
      }
      console.log("Best Solution: " + formatTimeDecimal(bestSolution.duration) + " (" + bestSolution.duration + ")");
      if(ignoreStupidSolutions) {
        console.log("Stupid solutions eliminated: " + stupidSolutions);
      }
      //print solution
      displaySolution(bestSolution);
      $('#results').show();
    }
  };
  
  // takes integer number
  // creates solution matching binary representation of tracks
  getSolutionById = function (id) {
    var solution = new Solution();
    // 5 -> 101 -> tracks 1, 3
    var binary = parseInt(id).toString(2);
    
    for(; binary.length < audioFiles.length;) {
      binary = "0" + binary;
    }
    
    var j = 0;
    for(var i = binary.length - 1; i >= 0; i--) {
      var current = binary.charAt(i);
      if(current == "1") {
        solution.trackIdsA.push(j);
      }
      else {
        solution.trackIdsB.push(j);
      }
      j++;
    }
    
    calculateDuration(solution);
    
    return solution;
  };
  
  getAllSolution = function () {
    var solution = new Solution();
    $.each(audioFiles, function (i, data) {
      solution.trackIdsA.push(i);
    });
    
    calculateDuration(solution);
    return solution;
  };
  
  // takes a solution, reads tracks on side A and saves duration to solution
  calculateDuration = function (solution) {
    var totalDuration = 0;
    
    // add in silence at start and end of tape
    totalDuration += secondsPaddingStart + secondsPaddingEnd;
    
    // add in silence between tracks
    totalDuration += secondsSilence * (solution.trackIdsA.length - 1);
    
    // add total track duration
    $.each(solution.trackIdsA, function (i, data) {
      totalDuration += audioFiles[data].duration;
    });
    
    // set solution duration to calculated duration
    solution.duration = totalDuration;
  };
  
  // returns true if this ID has more "1"s than the max possible or fewer than the min
  isStupidSolution = function (id) {
    if(ignoreStupidSolutions) {
      // check if too many or too few tracks
      
      // fast regex solution
      var binary = parseInt(id).toString(2);
      const pattern = new RegExp('^0*(10*){'+minTrackCount+','+maxTrackCount+'}$');
      return !pattern.test(binary);

      // slooooooow
      //var numTracks = (binary.split("1").length - 1);
      //return (numTracks > maxTrackCount || numTracks < minTrackCount);
    }
    return false;
  };
  
  clearSolution = function () {
    $('#resultSection').empty();
    $('#resultSectionA').empty();
    $('#resultSectionB').empty();
    var header = "<tr><th>Track Name</th><th>Duration</th><th>Side</th></tr>";
    var headerAB = "<tr><th></th><th>Track Name</th><th>Duration</th></tr>";
    $('#resultSection').append(header);
    $('#resultSectionA').append(headerAB);
    $('#resultSectionB').append(headerAB);
    sideA = [];
    sideB = [];
    timesSideA = [];
    timesSideB = [];
    endTimeA = 0;
    endTimeB = 0;
    endTime = 0;
  };
  
  displaySolution = function (solution) {
    clearSolution();
    
    var durationSideB = 0;
    
    $.each(solution.trackIdsA, function (i, data) {
      var track = audioFiles[data];
      
      //var arrows = '<span class="upArrow unselectable" onclick="moveTrackUp('+data+');">UP</span><span class="downArrow unselectable" onclick="moveTrackDown('+data+');">DN</span>';
      var arrows = '<span class="unselectable">' + buildUpArrowImage(data, i==0) + buildDownArrowImage(data, i==solution.trackIdsA.length-1) + '</span>';
      var dur = formatTimeDecimal(track.duration);
      //var row = "<tr><td>"+arrows+"</td><td>"+track.name+"</td><td>"+dur+"</td><td>"+side+"</td></tr>";
      //$('#resultSection').append(row);
      
      var splitRow = "<tr><td>"+arrows+"</td><td>"+track.name+"</td><td>"+dur+"</td></tr>";
      $('#resultSectionA').append(splitRow);
      sideA.push(i);
    });
    
    $.each(solution.trackIdsB, function (i, data) {
      var track = audioFiles[data];
      
      durationSideB += track.duration;
      //var arrows = '<span onclick="moveTrackUp('+data+');">UP</span>';
      var arrows = '<span class="unselectable">' + buildUpArrowImage(data, i==0) + buildDownArrowImage(data, i==solution.trackIdsB.length-1) + '</span>';
      var dur = formatTimeDecimal(track.duration);
      //var row = "<tr><td>"+arrows+"</td><td>"+track.name+"</td><td>"+dur+"</td><td>"+side+"</td></tr>";
      //$('#resultSection').append(row);
      
      var splitRow = "<tr><td>"+arrows+"</td><td>"+track.name+"</td><td>"+dur+"</td></tr>";
      $('#resultSectionB').append(splitRow);
      sideB.push(i);
    });
    /*
    $.each(audioFiles, function (i, data) {
      var side = "B";
      if(solution.trackIdsA.indexOf(i) != -1) {
        side = "A";
      }
      else {
        durationSideB += data.duration;
      }
      var arrows = '<span onclick="moveTrackUp('+i+');">UP</span>';
      var dur = formatTimeDecimal(data.duration);
      var row = "<tr><td>"+arrows+"</td><td>"+data.name+"</td><td>"+dur+"</td><td>"+side+"</td></tr>";
      $('#resultSection').append(row);
      
      var splitRow = "<tr><td>"+data.name+"</td><td>"+dur+"</td></tr>";
      if(side == "A") {
        $('#resultSectionA').append(splitRow);
        sideA.push(i);
      }
      else {
        $('#resultSectionB').append(splitRow);
        sideB.push(i);
      }
    });*/
    
    timesSideA = calculateTrackTimes(solution.trackIdsA);
    timesSideB = calculateTrackTimes(solution.trackIdsB);
    
    endTimeA = solution.duration;
    endTimeB = durationSideB;
    
    $('#titleSideA').text("Side A - " + bestSolution.trackIdsA.length + " Track" + (bestSolution.trackIdsA.length != 1 ? "s":"") + " - " + formatTimeDecimal(endTimeA));
    $('#titleSideB').text("Side B - " + bestSolution.trackIdsB.length + " Track" + (bestSolution.trackIdsB.length != 1 ? "s":"") + " - " + formatTimeDecimal(endTimeB));
    
    var percentFullA = endTimeA / secondsSideA;
    var percentFullB = endTimeB / secondsSideB;
    
    console.log("percent full side A: " + percentFullA);
    
    // update width of bar to show how full the tape is
    $('#tapeFilledBarA').css("width", percentFullA * 300);
    $('#tapeFilledBarB').css("width", percentFullB * 300);
    
    // show play buttons
    if(solution.trackIdsA.length > 0) {
      $('#playSideA').show();
    }
    if(solution.trackIdsB.length > 0) {
      $('#playSideB').show();
    }
    
    $('#resultCombined').hide();
  };
  
  // calculates expected start time in millis since pressing play side
  calculateTrackTimes = function (tracks) {
    var result = [];
    var time = 0; // adds up for each track
    time += (secondsPaddingStart * 1000);
    $.each(tracks, function (i, trackIndex) {
      result.push(time);
      time += (audioFiles[trackIndex].duration * 1000);
      time += (secondsSilence * 1000);
    });
    return result;
  };
  
  getMinTrackCount = function () {
    var sortedTracks = audioFiles.slice().sort(compareTracks);
    console.log("sorting tracks largest to smallest");
    var totalSeconds = 0;
    totalSeconds += secondsPaddingStart + secondsPaddingEnd;
    var maxSeconds = secondsSideA;
    var i = 0;
    for(; i < sortedTracks.length && totalSeconds < maxSeconds; i++) {
      //console.log("sorted track duration: " + sortedTracks[i].duration);
      totalSeconds += sortedTracks[i].duration;
      if(i > 0) {
        totalSeconds += secondsSilence;
      }
    }
    if(totalSeconds < maxSeconds) {
      console.log("min number of tracks: " + sortedTracks.length);
      return sortedTracks.length;
    }
    else {
      console.log("min number of tracks: " + (i-1));
      return (i-1);
    }
  };
  
  getMaxTrackCount = function () {
    var sortedTracks = audioFiles.slice().sort(compareTracks).reverse();
    console.log("sorting tracks smallest to largest");
    var totalSeconds = 0;
    totalSeconds += secondsPaddingStart + secondsPaddingEnd;
    var maxSeconds = secondsSideA;
    var i = 0;
    for(; i < sortedTracks.length && totalSeconds < maxSeconds; i++) {
      //console.log("sorted track duration: " + sortedTracks[i].duration);
      totalSeconds += sortedTracks[i].duration;
      if(i > 0) {
        totalSeconds += secondsSilence;
      }
    }
    if(totalSeconds < maxSeconds) {
      console.log("min number of tracks: " + sortedTracks.length);
      return sortedTracks.length;
    }
    else {
      console.log("max number of tracks: " + (i-1));
      return (i-1);
    }
  };
  
  // sorting tracks by length
  compareTracks = function (a, b) {
    return b.duration - a.duration;
  };
  
  hideControlButtons();
});
