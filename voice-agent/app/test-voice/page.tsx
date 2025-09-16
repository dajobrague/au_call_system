'use client';

/**
 * Twilio WebRTC Voice Test Interface
 * Browser-based testing for the AI voice agent
 */

import { useState, useEffect, useRef } from 'react';

interface CallLog {
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export default function VoiceTestPage() {
  const [device, setDevice] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [identity, setIdentity] = useState('test-user');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('+17744834860');
  const [audioInputLevel, setAudioInputLevel] = useState(0);
  const [audioOutputLevel, setAudioOutputLevel] = useState(0);
  const [recordings, setRecordings] = useState<Array<{
    id: string;
    text: string;
    url: string;
    timestamp: string;
    duration?: number;
  }>>([]);

  const deviceRef = useRef<any>(null);
  const currentCall = useRef<any>(null);

  // Add log entry
  const addLog = (type: CallLog['type'], message: string) => {
    const logEntry: CallLog = {
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
    };
    setCallLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50 logs
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Initialize Twilio Device
  const initializeDevice = async () => {
    try {
      setIsLoading(true);
      addLog('info', 'Loading Twilio Voice SDK...');

      // Dynamically import Twilio Device
      const { Device } = await import('@twilio/voice-sdk');
      
      addLog('info', 'Getting access token...');

      // Get access token
      const tokenResponse = await fetch('/api/test/voice/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token request failed: ${tokenResponse.status} - ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      
      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Failed to get access token');
      }

      addLog('success', 'Access token received');
      addLog('info', 'Creating Twilio Device...');

      // Create and setup device
      const newDevice = new Device(tokenData.token, {
        logLevel: 1, // Info level
      });

      // Device event listeners
      newDevice.on('ready', () => {
        addLog('success', '✅ Twilio Device ready for calls');
        setIsConnected(true);
      });

      newDevice.on('error', (error: any) => {
        addLog('error', `❌ Device error: ${error.message}`);
        setIsConnected(false);
      });

      newDevice.on('offline', () => {
        addLog('warning', '⚠️ Device went offline');
        setIsConnected(false);
      });

      newDevice.on('incoming', (call: any) => {
        addLog('info', `📞 Incoming call from: ${call.parameters.From}`);
        // Auto-accept incoming calls for testing
        call.accept();
      });

      deviceRef.current = newDevice;
      setDevice(newDevice);

      addLog('info', 'Device setup complete, waiting for ready state...');

    } catch (error) {
      addLog('error', `❌ Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Make outgoing call
  const makeCall = async () => {
    if (!device || !isConnected) {
      addLog('error', '❌ Device not ready');
      return;
    }

    try {
      addLog('info', `📞 Calling ${phoneNumber}...`);
      
      const call = await device.connect({
        params: {
          To: phoneNumber,
        }
      });
      
      currentCall.current = call;
      setIsInCall(true);
      
      addLog('success', `✅ Call connected to ${phoneNumber}`);

      // Setup call listeners
      call.on('disconnect', () => {
        addLog('info', '📴 Call disconnected');
        setIsInCall(false);
        currentCall.current = null;
      });

      call.on('cancel', () => {
        addLog('info', '🚫 Call cancelled');
        setIsInCall(false);
        currentCall.current = null;
      });

      call.on('error', (error: any) => {
        addLog('error', `❌ Call error: ${error.message}`);
        setIsInCall(false);
      });

      // Audio level monitoring
      call.on('volume', (inputVolume: number, outputVolume: number) => {
        setAudioInputLevel(inputVolume);
        setAudioOutputLevel(outputVolume);
      });

    } catch (error) {
      addLog('error', `❌ Call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Hang up call
  const hangUpCall = () => {
    if (currentCall.current) {
      currentCall.current.disconnect();
      addLog('info', '📴 Call hung up by user');
    }
  };

  // Send DTMF tones (for testing legacy flow)
  const sendDTMF = (digit: string) => {
    if (currentCall.current && isInCall) {
      currentCall.current.sendDigits(digit);
      addLog('info', `🔢 Sent DTMF: ${digit}`);
    } else {
      addLog('warning', '⚠️ Cannot send DTMF: Not in call');
    }
  };

  // Clear logs
  const clearLogs = () => {
    setCallLogs([]);
    addLog('info', '🧹 Logs cleared');
  };

  // Test ElevenLabs TTS
  const testTTS = async () => {
    try {
      addLog('info', '🎵 Testing ElevenLabs TTS...');
      
      const response = await fetch('/api/test/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: 'Hello! This is a test of the ElevenLabs text to speech system. The voice should sound natural and clear.' 
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        await audio.play();
        
        addLog('success', `✅ TTS test successful - ${audioBlob.size} bytes`);
      } else {
        const error = await response.json();
        addLog('error', `❌ TTS test failed: ${error.error}`);
      }
    } catch (error) {
      addLog('error', `❌ TTS test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center">
            🎙️ AI Voice Agent - WebRTC Test Interface
          </h1>
          <p className="text-gray-600 text-lg">
            Test your AI voice agent directly in the browser using Twilio WebRTC
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800">🎛️ Control Panel</h2>
              
              {/* Connection Status */}
              <div className="mb-6">
                <div className={`p-4 rounded-lg font-semibold text-center ${
                  isConnected 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {isConnected ? '✅ Device Connected' : '❌ Device Disconnected'}
                </div>
              </div>

              {/* Device Setup */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Identity:
                  </label>
                  <input
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="test-user"
                    disabled={isConnected}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number:
                  </label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+17744834860"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 mb-6">
                {!isConnected ? (
                  <button
                    onClick={initializeDevice}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                  >
                    {isLoading ? '⏳ Initializing...' : '🔌 Initialize Device'}
                  </button>
                ) : (
                  <>
                    {!isInCall ? (
                      <button
                        onClick={makeCall}
                        className="w-full bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 font-semibold transition-colors"
                      >
                        📞 Call Voice Agent
                      </button>
                    ) : (
                      <button
                        onClick={hangUpCall}
                        className="w-full bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 font-semibold transition-colors"
                      >
                        📴 Hang Up
                      </button>
                    )}
                  </>
                )}
                
                <button
                  onClick={testTTS}
                  className="w-full bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 font-semibold transition-colors"
                >
                  🎵 Test ElevenLabs TTS
                </button>
              </div>

              {/* Audio Levels */}
              {isInCall && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold mb-3 text-gray-800">📊 Audio Levels</h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Microphone Input</span>
                        <span>{Math.round(audioInputLevel * 100)}%</span>
                      </div>
                      <div className="bg-gray-200 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-green-500 h-full rounded-full audio-level-bar"
                          style={{ width: `${audioInputLevel * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Speaker Output</span>
                        <span>{Math.round(audioOutputLevel * 100)}%</span>
                      </div>
                      <div className="bg-gray-200 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full audio-level-bar"
                          style={{ width: `${audioOutputLevel * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DTMF Pad */}
              {isInCall && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h3 className="font-semibold mb-3 text-gray-800">🔢 DTMF Keypad</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
                      <button
                        key={digit}
                        onClick={() => sendDTMF(digit)}
                        className="bg-white hover:bg-gray-100 border border-gray-300 p-3 rounded-lg text-center font-mono font-bold text-lg transition-colors"
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Use for testing legacy DTMF flow
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Call Logs */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-800">📋 Call Logs</h2>
                <button
                  onClick={clearLogs}
                  className="text-sm bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  🧹 Clear
                </button>
              </div>
              
              <div className="bg-gray-900 text-green-400 p-6 rounded-lg font-mono text-sm h-96 overflow-y-auto border">
                {callLogs.map((log, index) => (
                  <div key={index} className={`mb-1 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    log.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}>
                    <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                  </div>
                ))}
                {callLogs.length === 0 && (
                  <div className="text-gray-500 text-center py-8">
                    💡 No logs yet. Initialize device to start testing.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">📚 Testing Guide</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold mb-3 text-blue-800">🚀 Quick Start</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-700">
                <li>Click "Initialize Device"</li>
                <li>Wait for "Device ready" message</li>
                <li>Click "Call Voice Agent"</li>
                <li>Speak naturally when connected</li>
                <li>Monitor logs for debugging</li>
              </ol>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold mb-3 text-green-800">🧪 Test Scenarios</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-green-700">
                <li>Voice authentication flow</li>
                <li>Job code collection</li>
                <li>Natural language options</li>
                <li>Error handling</li>
                <li>Audio quality & latency</li>
              </ul>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold mb-3 text-purple-800">🔧 Debug Tools</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-purple-700">
                <li>Real-time call logs</li>
                <li>Audio level monitoring</li>
                <li>DTMF keypad testing</li>
                <li>TTS quality testing</li>
                <li>Connection diagnostics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}