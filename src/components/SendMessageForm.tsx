"use client";

import { useMemo, useRef, useState } from "react";
import { sendLeadMessageAction } from "@/app/(app)/communications/actions";
import { CHANNELS } from "@/lib/constants";

type Tpl = { id: string; name: string; channel: string; subject: string | null; body: string };

export function SendMessageForm({
  leadId,
  leadPhone,
  leadEmail,
  templates,
}: {
  leadId: string;
  leadPhone: string;
  leadEmail: string | null;
  templates: Tpl[];
}) {
  const [channel, setChannel] = useState("WHATSAPP");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const channelTemplates = useMemo(() => templates.filter((t) => t.channel === channel), [templates, channel]);
  const recipient = channel === "EMAIL" ? leadEmail ?? "" : leadPhone;
  const noRecipient = !recipient;

  function applyTemplate(id: string) {
    const t = channelTemplates.find((x) => x.id === id);
    if (t) {
      setBody(t.body);
      setSubject(t.subject ?? "");
    }
  }

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await sendLeadMessageAction(fd);
        setBody("");
        setSubject("");
      }}
      className="space-y-3"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Channel</label>
          <select name="channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Template</label>
          <select className="input" defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Choose template —</option>
            {channelTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        To: {recipient || <span className="text-rose-500">no {channel === "EMAIL" ? "email" : "phone"} on file</span>}
      </p>

      {channel === "EMAIL" && (
        <div>
          <label className="label">Subject</label>
          <input name="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label">Message</label>
        <textarea name="body" rows={3} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type or pick a template…" required />
      </div>
      <button type="submit" className="btn-primary" disabled={noRecipient || !body.trim()}>Send {CHANNELS[channel as keyof typeof CHANNELS]}</button>
    </form>
  );
}
