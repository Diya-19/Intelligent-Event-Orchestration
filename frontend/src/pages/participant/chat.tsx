import React, { useEffect, useRef, useState } from "react";
import { Search, Phone, Info, Send, Plus, MoreVertical, MessageCircle, X } from "lucide-react";
import { api, wsBase } from "../../lib/api";
import { getParticipantToken } from "../../lib/auth";

interface Room {
  id: string;
  name: string;
  icon?: string;
  room_type: "channel" | "dm";
  last_message: string;
}

interface Message {
  id: string;
  room_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_initials: string;
  content: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export default function TeamChatPage() {
  const [channels, setChannels] = useState<Room[]>([]);
  const [dms, setDms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<string | null>(null);

  // DM picker state
  const [showDmPicker, setShowDmPicker] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [dmLoading, setDmLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Fetch own ID so we can hide self from DM picker
    api.get("/api/participant/dashboard")
      .then((res) => setSelfId(res.data?.participant?.id ?? null))
      .catch(() => {});

    api.get("/api/participant/chat/rooms")
      .then((res) => {
        setChannels(res.data.channels ?? []);
        setDms(res.data.dms ?? []);
        if (res.data.channels?.length) selectRoom(res.data.channels[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectRoom(room: Room) {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSelectedRoom(room);
    setMessages([]);
    setShowDmPicker(false);

    api.get(`/api/participant/chat/rooms/${room.id}/messages`)
      .then((res) => setMessages(res.data ?? []))
      .catch(console.error);

    const token = getParticipantToken();
    const wsPath = token
      ? `/api/participant/chat/ws/${room.id}?token=${token}`
      : `/api/participant/chat/ws/${room.id}`;
    const ws = new WebSocket(`${wsBase()}${wsPath}`);

    ws.onmessage = (e) => {
      const msg: Message = JSON.parse(e.data);
      setMessages((prev) => [...prev, msg]);
    };
    ws.onerror = (e) => console.error("WS error", e);
    wsRef.current = ws;
  }

  function openDmPicker() {
    setShowDmPicker(true);
    if (teamMembers.length > 0) return;
    setDmLoading(true);
    api.get("/api/participant/team")
      .then((res) => setTeamMembers(res.data?.members ?? []))
      .catch(console.error)
      .finally(() => setDmLoading(false));
  }

  function startDm(memberId: string, memberName: string) {
    api.post("/api/participant/chat/rooms/dm", { target_participant_id: memberId })
      .then((res) => {
        const newRoom: Room = {
          id: res.data.id,
          name: memberName,
          room_type: "dm",
          last_message: "",
        };
        setDms((prev) => {
          const exists = prev.find((d) => d.id === newRoom.id);
          return exists ? prev : [newRoom, ...prev];
        });
        selectRoom(newRoom);
      })
      .catch(console.error);
  }

  function sendMessage() {
    const content = input.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ content }));
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="h-20 bg-white border-b flex items-center justify-between px-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Chat</h1>
          <p className="text-gray-500 mt-1">Collaborate, discuss ideas and build something amazing! 🚀</p>
        </div>
        <button className="w-12 h-12 border rounded-xl flex items-center justify-center">
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="px-8 pt-6">
        <div className="grid grid-cols-[320px_1fr] gap-6">
          {/* Left Panel */}
          <div className="bg-white border rounded-2xl p-5 h-fit">
            {/* Channels */}
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-lg">Conversations</h3>
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : channels.length === 0 ? (
              <p className="text-sm text-gray-400">No channels yet — join a team first.</p>
            ) : (
              <div className="space-y-2">
                {channels.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => selectRoom(room)}
                    className={`p-4 rounded-xl cursor-pointer transition-colors ${
                      selectedRoom?.id === room.id
                        ? "bg-violet-50 border border-violet-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {room.icon} {room.name}
                    </div>
                    {room.last_message && (
                      <div className="text-sm text-gray-500 mt-1 truncate">{room.last_message}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* DMs */}
            <div className="border-t my-6" />
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Direct Messages</h3>
              <button
                onClick={openDmPicker}
                className="w-10 h-10 border rounded-xl flex items-center justify-center hover:bg-gray-50 transition-colors"
                title="New direct message"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* DM picker dropdown */}
            {showDmPicker && (
              <div className="mb-4 border rounded-xl p-3 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Start a DM with...</span>
                  <button onClick={() => setShowDmPicker(false)}>
                    <X size={14} className="text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
                {dmLoading ? (
                  <p className="text-sm text-gray-400">Loading team...</p>
                ) : teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-400">No team members found.</p>
                ) : (
                  <div className="space-y-1">
                    {teamMembers.filter((m) => m.id !== selfId).map((m) => (
                      <div
                        key={m.id}
                        onClick={() => startDm(m.id, m.name)}
                        className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-xs font-semibold">
                          {m.name[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{m.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dms.length === 0 && !showDmPicker && (
              <p className="text-sm text-gray-400">No direct messages yet.</p>
            )}

            <div className="space-y-3">
              {dms.map((dm) => (
                <div
                  key={dm.id}
                  onClick={() => selectRoom(dm)}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                    selectedRoom?.id === dm.id ? "bg-violet-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-violet-200 flex items-center justify-center text-violet-700 font-semibold text-sm">
                    {dm.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{dm.name}</div>
                    {dm.last_message && (
                      <div className="text-xs text-gray-400 truncate max-w-[180px]">{dm.last_message}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="bg-white border rounded-2xl overflow-hidden flex flex-col h-[780px]">
            {selectedRoom ? (
              <>
                <div className="h-20 border-b px-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-xl">
                      {selectedRoom.room_type === "channel"
                        ? `${selectedRoom.icon ?? "#"} ${selectedRoom.name}`
                        : selectedRoom.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedRoom.room_type === "channel" ? "Team channel" : "Direct message"}
                    </p>
                  </div>
                  <div className="flex gap-5">
                    <Search size={20} className="text-gray-500" />
                    <Phone size={20} className="text-gray-500" />
                    <Info size={20} className="text-gray-500" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 && (
                    <p className="text-center text-gray-400 mt-8">No messages yet. Say hello!</p>
                  )}
                  {messages.map((msg) => (
                    <div key={msg.id} className="flex gap-4">
                      <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                        {msg.sender_initials}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{msg.sender_name}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="mt-1 text-gray-800">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="border-t p-4">
                  <div className="border rounded-xl flex items-center px-4 py-3">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message... (Enter to send)"
                      className="flex-1 outline-none"
                    />
                    <button
                      onClick={sendMessage}
                      className="bg-violet-600 text-white p-3 rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}