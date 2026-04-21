import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function App() {
  const [config, setConfig] = useState({
    translationEnabled: true,
    voiceChannelIds: [],
    notificationChannelId: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [newChannelId, setNewChannelId] = useState('');
  const [notifChannelId, setNotifChannelId] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/config`);
      setConfig(res.data);
      setNotifChannelId(res.data.notificationChannelId || '');
    } catch (err) {
      showMessage('ไม่สามารถโหลด config ได้: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    try {
      setSaving(true);
      const payload = {
        ...config,
        notificationChannelId: notifChannelId.trim(),
      };
      const res = await axios.post(`${API_URL}/api/config`, payload);
      setConfig(res.data.config);
      showMessage('บันทึกการตั้งค่าสำเร็จ', 'success');
    } catch (err) {
      showMessage('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTranslation() {
    try {
      const res = await axios.post(`${API_URL}/api/config/toggle-translation`);
      setConfig((prev) => ({ ...prev, translationEnabled: res.data.translationEnabled }));
      showMessage(
        res.data.translationEnabled ? 'เปิดระบบแปลภาษาแล้ว' : 'ปิดระบบแปลภาษาแล้ว',
        'success'
      );
    } catch (err) {
      showMessage('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  }

  function addVoiceChannel() {
    const id = newChannelId.trim();
    if (!id) return;
    if (config.voiceChannelIds.includes(id)) {
      showMessage('Channel ID นี้มีอยู่แล้ว', 'error');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      voiceChannelIds: [...prev.voiceChannelIds, id],
    }));
    setNewChannelId('');
  }

  function removeVoiceChannel(id) {
    setConfig((prev) => ({
      ...prev,
      voiceChannelIds: prev.voiceChannelIds.filter((c) => c !== id),
    }));
  }

  function showMessage(text, type) {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#151820]">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.114 18.102.13 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold">Discord Bot Dashboard</h1>
            <p className="text-sm text-gray-400">ตั้งค่าระบบบอท</p>
          </div>
        </div>
      </header>

      {/* Toast Message */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
            message.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {message.type === 'success' ? '✅ ' : '❌ '}
          {message.text}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        {/* Translation Settings */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">ระบบแปลภาษา</h2>
              <p className="text-sm text-gray-400 mt-1">
                ตรวจจับภาษาเวียดนามและแปลเป็นไทยอัตโนมัติ
              </p>
            </div>
            <button
              onClick={toggleTranslation}
              className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none ${
                config.translationEnabled ? 'bg-indigo-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                  config.translationEnabled ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div
            className={`px-4 py-3 rounded-xl text-sm font-medium ${
              config.translationEnabled
                ? 'bg-green-900/30 border border-green-700 text-green-400'
                : 'bg-gray-800 border border-gray-700 text-gray-400'
            }`}
          >
            {config.translationEnabled ? '🟢 เปิดใช้งาน' : '⚫ ปิดใช้งาน'}
          </div>

          <div className="mt-4 space-y-2 text-sm text-gray-400">
            <p>• ภาษาเวียดนาม → แปลเป็นไทยอัตโนมัติ</p>
            <p>• คำสั่ง <code className="bg-gray-800 px-1.5 py-0.5 rounded text-indigo-400">!th &lt;ข้อความ&gt;</code> แปลไทย → เวียดนาม</p>
          </div>
        </div>

        {/* Notification Channel */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-1">ช่องแจ้งเตือน Voice Channel</h2>
          <p className="text-sm text-gray-400 mb-4">
            Channel ID ที่บอทจะส่ง Embed แจ้งเตือนเข้า-ออก Voice
          </p>
          <input
            type="text"
            value={notifChannelId}
            onChange={(e) => setNotifChannelId(e.target.value)}
            placeholder="ใส่ Channel ID เช่น 1234567890123456789"
            className="w-full bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-2">
            วิธีหา Channel ID: คลิกขวาที่ channel ใน Discord → Copy Channel ID (ต้องเปิด Developer Mode)
          </p>
        </div>

        {/* Voice Channels to Monitor */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-1">Voice Channels ที่ต้องการติดตาม</h2>
          <p className="text-sm text-gray-400 mb-4">
            เพิ่ม Voice Channel ID ที่ต้องการรับแจ้งเตือน (เว้นว่างไว้ = ติดตามทุก channel)
          </p>

          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={newChannelId}
              onChange={(e) => setNewChannelId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVoiceChannel()}
              placeholder="Voice Channel ID"
              className="flex-1 bg-[#0f1117] border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={addVoiceChannel}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-medium transition-colors"
            >
              เพิ่ม
            </button>
          </div>

          {config.voiceChannelIds.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm border border-dashed border-gray-700 rounded-xl">
              ยังไม่มี Channel ที่กำหนด — ระบบจะติดตามทุก Voice Channel
            </div>
          ) : (
            <div className="space-y-2">
              {config.voiceChannelIds.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between bg-[#0f1117] rounded-xl px-4 py-3 border border-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <code className="text-sm text-indigo-300">{id}</code>
                  </div>
                  <button
                    onClick={() => removeVoiceChannel(id)}
                    className="text-gray-500 hover:text-red-400 transition-colors text-sm px-2 py-1 rounded-lg hover:bg-red-900/20"
                  >
                    ลบ
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={saveConfig}
          disabled={saving}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-2xl font-semibold text-base transition-colors"
        >
          {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
        </button>

        {/* Bot Invite */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-2">เชิญบอทเข้า Server</h2>
          <p className="text-sm text-gray-400 mb-4">
            คลิกลิงก์ด้านล่างเพื่อเชิญบอทเข้าสู่ Discord Server ของคุณ
          </p>
          <a
            href="https://discord.com/oauth2/authorize?client_id=1495993441321226480&permissions=274877991936&scope=bot"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#5865f2] hover:bg-[#4752c4] rounded-xl text-sm font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.101 18.08.114 18.102.13 18.116a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            เชิญบอทเข้า Server
          </a>
        </div>

        {/* Info Card */}
        <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">สถานะระบบ</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0f1117] rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">ระบบแปลภาษา</p>
              <p className={`text-sm font-medium ${config.translationEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                {config.translationEnabled ? '🟢 เปิด' : '⚫ ปิด'}
              </p>
            </div>
            <div className="bg-[#0f1117] rounded-xl p-4 border border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Voice Channels</p>
              <p className="text-sm font-medium text-indigo-400">
                {config.voiceChannelIds.length === 0
                  ? 'ทั้งหมด'
                  : `${config.voiceChannelIds.length} ช่อง`}
              </p>
            </div>
            <div className="bg-[#0f1117] rounded-xl p-4 border border-gray-800 col-span-2">
              <p className="text-xs text-gray-500 mb-1">ช่องแจ้งเตือน</p>
              <p className="text-sm font-medium text-indigo-300 font-mono">
                {notifChannelId || 'ยังไม่ได้ตั้งค่า'}
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-6 text-gray-600 text-xs">
        Discord Bot Dashboard • Bot รันบน GitHub Actions 24/7
      </footer>
    </div>
  );
}
