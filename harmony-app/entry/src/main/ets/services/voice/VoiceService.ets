import { audio } from '@kit.AudioKit';
import { speechRecognizer, textToSpeech } from '@kit.CoreSpeechKit';

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'error';
export type VoiceStateListener = (state: VoiceState, message: string) => void;
export type VoiceTextListener = (text: string) => void;

/** Native ASR/TTS adapter. It never sends commands to the robot by itself. */
export default class VoiceService {
  private recognizer: speechRecognizer.SpeechRecognitionEngine | undefined;
  private capturer: audio.AudioCapturer | undefined;
  private tts: textToSpeech.TextToSpeechEngine | undefined;
  private sessionId: string = '';
  private stateListener: VoiceStateListener = (_state: VoiceState, _message: string): void => {};
  private textListener: VoiceTextListener = (_text: string): void => {};

  public setListeners(stateListener: VoiceStateListener, textListener: VoiceTextListener): void {
    this.stateListener = stateListener;
    this.textListener = textListener;
  }

  public async startListening(): Promise<void> {
    if (this.recognizer !== undefined || this.capturer !== undefined) {
      return;
    }
    try {
      this.sessionId = `xuanxun-${Date.now()}`;
      this.recognizer = await speechRecognizer.createEngine({
        language: 'zh-CN',
        online: 0
      });
      const recognizer: speechRecognizer.SpeechRecognitionEngine = this.recognizer;
      recognizer.setListener({
        onStart: (_sessionId: string, _message: string): void => {
          this.stateListener('listening', '正在聆听任务');
        },
        onEvent: (_sessionId: string, _code: number, _message: string): void => {},
        onResult: (_sessionId: string, result: speechRecognizer.SpeechRecognitionResult): void => {
          if (result.isFinal && result.result.trim().length > 0) {
            this.textListener(result.result.trim());
          }
        },
        onComplete: (_sessionId: string, _message: string): void => {
          this.stateListener('idle', '语音输入完成');
        },
        onError: (_sessionId: string, _code: number, message: string): void => {
          this.stateListener('error', message || '语音识别失败');
          void this.stopListening();
        }
      });
      this.capturer = await audio.createAudioCapturer({
        streamInfo: {
          samplingRate: audio.AudioSamplingRate.SAMPLE_RATE_16000,
          channels: audio.AudioChannel.CHANNEL_1,
          sampleFormat: audio.AudioSampleFormat.SAMPLE_FORMAT_S16LE,
          encodingType: audio.AudioEncodingType.ENCODING_TYPE_RAW
        },
        capturerInfo: {
          source: audio.SourceType.SOURCE_TYPE_VOICE_RECOGNITION,
          capturerFlags: 0
        }
      });
      const capturer: audio.AudioCapturer = this.capturer;
      capturer.on('readData', (buffer: ArrayBuffer): void => {
        if (this.recognizer !== undefined && this.sessionId.length > 0) {
          this.recognizer.writeAudio(this.sessionId, new Uint8Array(buffer));
        }
      });
      recognizer.startListening({
        sessionId: this.sessionId,
        audioInfo: {
          audioType: 'pcm',
          sampleRate: 16000,
          soundChannel: 1,
          sampleBit: 16
        }
      });
      await capturer.start();
      this.stateListener('listening', '正在聆听任务');
    } catch (error) {
      this.stateListener('error', `语音输入不可用：${JSON.stringify(error)}`);
      await this.stopListening();
    }
  }

  public async stopListening(): Promise<void> {
    if (this.recognizer !== undefined && this.sessionId.length > 0) {
      try {
        this.recognizer.finish(this.sessionId);
      } catch (_) {
        // The system may already have completed the session.
      }
    }
    if (this.capturer !== undefined) {
      try {
        await this.capturer.stop();
      } catch (_) {
        // The capturer may already be stopped by the system.
      }
      this.capturer.off('readData');
    }
    if (this.recognizer !== undefined) {
      this.recognizer.shutdown();
    }
    this.capturer = undefined;
    this.recognizer = undefined;
    this.sessionId = '';
    this.stateListener('idle', '');
  }

  public async speak(text: string): Promise<void> {
    const content: string = text.trim();
    if (content.length === 0) {
      return;
    }
    try {
      if (this.tts === undefined) {
        this.tts = await textToSpeech.createEngine({
          language: 'zh-CN',
          person: 0,
          online: 0
        });
        this.tts.setListener({
          onStart: (_requestId: string, _response: textToSpeech.StartResponse): void => {
            this.stateListener('speaking', '正在播报');
          },
          onComplete: (_requestId: string, _response: textToSpeech.CompleteResponse): void => {
            this.stateListener('idle', '');
          },
          onStop: (_requestId: string, _response: textToSpeech.StopResponse): void => {
            this.stateListener('idle', '');
          },
          onError: (_requestId: string, _code: number, message: string): void => {
            this.stateListener('error', message || '语音播报失败');
          }
        });
      }
      this.tts.speak(content, { requestId: `xuanxun-tts-${Date.now()}` });
    } catch (error) {
      this.stateListener('error', `语音播报不可用：${JSON.stringify(error)}`);
    }
  }

  public async dispose(): Promise<void> {
    await this.stopListening();
    if (this.tts !== undefined) {
      this.tts.shutdown();
      this.tts = undefined;
    }
  }
}
