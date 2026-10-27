"use client";

import { Mail, Shuffle } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { SAMPLES } from "@/lib/samples";
import type { Lead } from "@/lib/types";
import { useToast } from "../Toast";
import { Button } from "../ui";

const MAX_CHARS = 4000;
// Примеры без пустого и «только телефон» — для ручного добавления они неинтересны
const EXAMPLES = SAMPLES.filter((s) => s.text.length > 40);

export function AddLeadDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (lead: Lead) => void }) {
  const toast = useToast();
  const titleId = useId();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX_CHARS;

  useEffect(() => {
    textRef.current?.focus();
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = overflow;
    };
  }, [onClose]);

  async function submit() {
    if (!trimmed || tooLong || saving) return;
    setSaving(true);
    try {
      // Уведомление не нужно: после добавления открывается карточка, разбор виден в ней
      onAdded(await api.addLead(trimmed));
    } catch (e) {
      toast.error(e);
      setSaving(false);
    }
  }

  function example() {
    const others = EXAMPLES.filter((s) => s.text !== text);
    setText(others[Math.floor(Math.random() * others.length)].text);
    textRef.current?.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fade-in absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="pop relative w-full max-w-xl rounded-t-3xl border border-line bg-surface p-5 shadow-[0_30px_60px_-20px_rgba(21,23,28,.35)] sm:rounded-3xl sm:p-6"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <Mail className="size-4.5" />
          </span>
          <h2 id={titleId} className="text-base font-semibold">
            Добавить заявку
          </h2>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          Вставьте текст письма или сообщения — нейросеть разберёт его за несколько секунд, карточка появится в колонке
          «Новая».
        </p>
        <textarea
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
          }}
          placeholder="Здравствуйте! Нужен сайт для…"
          className="mt-4 block max-h-[60vh] min-h-44 w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed outline-none field-sizing-content transition-shadow placeholder:text-ink-3 focus:border-accent/40 focus:ring-4 focus:ring-accent-soft"
        />
        <div className="mt-2 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={example}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 font-medium text-ink-2 hover:bg-sunken hover:text-ink"
          >
            <Shuffle className="size-3.5" />
            Подставить пример
          </button>
          <span className={tooLong ? "font-semibold text-danger" : "text-ink-3"}>
            {trimmed.length.toLocaleString("ru-RU")} / {MAX_CHARS.toLocaleString("ru-RU")}
          </span>
        </div>
        <div className="mt-5 flex gap-2 sm:justify-end">
          <Button className="max-sm:flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button
            variant="primary"
            className="max-sm:flex-1"
            loading={saving}
            disabled={!trimmed || tooLong}
            onClick={submit}
          >
            Добавить
          </Button>
        </div>
      </div>
    </div>
  );
}
