import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouterState } from "@tanstack/react-router";
import { ArrowUp, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendChat } from "@/features/gym/ai.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; content: string };

const chatQuery = {
  queryKey: ["chat"],
  queryFn: async (): Promise<Msg[]> => {
    const { data, error } = await supabase.from("chat_messages").select("id,role,content").order("created_at").limit(200);
    if (error) throw new Error(error.message);
    return data;
  },
};

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const qc = useQueryClient();
  // The workout screen has its own fixed Finish bar; keep the chat button out of its way.
  const onWorkout = useRouterState({ select: (s) => s.location.pathname.startsWith("/gym/workout") });
  const send = useServerFn(sendChat);
  const { data: messages = [] } = useQuery({ ...chatQuery, enabled: open });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open, pending]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending, open]);

  async function submit() {
    const msg = text.trim();
    if (!msg || pending) return;
    setText("");
    setPending(msg);
    try {
      await send({ data: { message: msg } });
    } catch {
      qc.setQueryData<Msg[]>(["chat"], (m = []) => [...m, { id: crypto.randomUUID(), role: "assistant", content: "Something went wrong — please try again." }]);
    }
    await Promise.all([qc.invalidateQueries({ queryKey: ["chat"] }), qc.invalidateQueries({ queryKey: ["gym"] })]);
    setPending(null);
  }

  return (
    <>
      <button
        aria-label="Open chat"
        onClick={() => setOpen(true)}
        className={cn(
          "press fixed bottom-[calc(var(--dock)+1.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-6 md:right-6",
          (open || onWorkout) && "hidden",
        )}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:border-l md:shadow-xl">
          <header className="flex h-14 items-center justify-between border-b px-4">
            <div className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Coach
            </div>
            <Button variant="ghost" size="icon" aria-label="Close chat" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.content} />
            ))}
            {pending && (
              <>
                <Bubble role="user" text={pending} />
                <div className="flex gap-1 px-1 py-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
              </>
            )}
            <div ref={endRef} />
          </div>
          <form
            className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex items-end gap-2 tile p-2">
              <textarea
                ref={inputRef}
                rows={1}
                aria-label="Message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="e.g. lateral raise is now 8 kg"
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={!text.trim() || !!pending} aria-label="Send">
                <ArrowUp className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Bubble({ role, text }: { role: string; text: string }) {
  if (role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{text}</div>
      </div>
    );
  return <div className="max-w-[90%] whitespace-pre-wrap px-1 text-sm leading-relaxed">{text}</div>;
}
