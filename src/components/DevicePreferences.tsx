import { Bell, LoaderCircle, Smartphone } from 'lucide-react';
import type { NativeReminderController } from '../hooks/useNativeReminders';

export function DevicePreferences({ reminders }: { reminders: NativeReminderController }) {
  return <div className="settings-section device-preferences"><h3>ON YOUR IPHONE</h3>{reminders.native ? <>
    <div className="preference-row"><span><span className="preference-label"><Bell size={14} />Timer reminders</span><span className="preference-description">A notification when the current session ends,<br />even with your screen locked.</span></span><button type="button" className="device-reminder-toggle" role="switch" aria-checked={reminders.enabled && reminders.permission === 'granted'} aria-label="Timer notifications on this iPhone" disabled={reminders.busy} onClick={() => void reminders.toggle()}>{reminders.busy ? <LoaderCircle size={16} className="spinning" /> : <span className={`device-switch ${reminders.enabled && reminders.permission === 'granted' ? 'on' : ''}`} />}</button></div>
    {reminders.error && <p className="note-form-error" role="alert">{reminders.error}</p>}
    <p className="device-preferences-note">Applied immediately. Notifications follow your iPhone's sound and Focus settings. Auto-start resumes when you reopen the app.</p>
  </> : <p className="device-preferences-note web-device-note"><Smartphone size={18} strokeWidth={1.5} /><span>The iOS build includes offline access and screen-lock timer reminders. In a browser, keep Pomodere open for the completion chime.</span></p>}</div>;
}