import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const showRecordingDialog = async (): Promise<boolean> => {
  const script = `
    tell application "System Events"
      display dialog "Would you like to start hand gesture recording?" buttons {"Cancel", "Start Recording"} default button "Start Recording" with title "Hand Gesture Control"
      set button_pressed to button returned of result
      return button_pressed
    end tell
  `;

  try {
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    return stdout.trim() === "Start Recording";
  } catch (error) {
    // User clicked Cancel or closed the dialog
    return false;
  }
}; 