"use client";

import {
  useActionState,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deleteProject } from "../actions";
import {
  changeRole,
  inviteMember,
  leaveProject,
  removeMember,
  transferOwnership,
} from "../members-actions";
import { disableShare, enableShare } from "../share-actions";
import {
  emptyMembersFormState,
  ROLE_LABEL_RU,
  type MemberInfo,
  type MemberRole,
} from "../members-state";

type ProjectManagementProps = {
  projectId: string;
  shareToken: string | null;
  members: MemberInfo[];
  currentUserId: string;
  myRole: MemberRole;
};

function memberLabel(m: MemberInfo): string {
  return m.display_name ?? m.email ?? "Без имени";
}

export function ProjectManagement({
  projectId,
  shareToken,
  members,
  currentUserId,
  myRole,
}: ProjectManagementProps) {
  const isOwner = myRole === "owner";
  const canEdit = myRole === "owner" || myRole === "editor";
  const otherMembers = members.filter((m) => m.user_id !== currentUserId);
  const ownersCount = members.filter((m) => m.role === "owner").length;
  const iAmSoleOwner = isOwner && ownersCount === 1;
  const mustTransferBeforeLeaving = iAmSoleOwner && otherMembers.length > 0;

  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteMember,
    emptyMembersFormState,
  );

  // Build the full share URL on the client (server doesn't know origin).
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (shareToken) {
      setShareUrl(`${window.location.origin}/share/${shareToken}`);
    } else {
      setShareUrl("");
    }
    setShareCopied(false);
  }, [shareToken]);

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Fallback: select the input so the user can copy manually.
      const input = document.getElementById(
        "share-link-input",
      ) as HTMLInputElement | null;
      input?.select();
    }
  }

  function confirmAndProceed(message: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    };
  }

  return (
    <>
      {/* === Members === */}
      <Card className="!p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] text-ink">
            Участники
          </h2>
          <span className="inline-flex items-center h-6 px-2 rounded-full bg-[#F4F4F1] text-muted text-[0.78rem] font-semibold">
            {members.length}
          </span>
        </div>

        <ul className="list-none p-0 m-0 grid gap-2">
          {members.map((m) => {
            const label = memberLabel(m);
            const isMe = m.user_id === currentUserId;
            const canManageThis = isOwner && !isMe && m.role !== "owner";

            return (
              <li
                key={m.user_id}
                className="flex items-center flex-wrap gap-3 border border-line rounded-card bg-paper px-4 py-3"
              >
                <div className="flex-1 min-w-0 grid gap-0.5">
                  <span className="text-[0.95rem] font-semibold text-ink truncate">
                    {label}
                    {isMe ? " (вы)" : ""}
                  </span>
                  {m.email && m.email !== label ? (
                    <span className="text-[0.82rem] text-muted truncate">
                      {m.email}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {canManageThis ? (
                    <form action={changeRole}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <Select
                        name="role"
                        defaultValue={m.role}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="!h-9 !text-[0.85rem]"
                        aria-label={`Роль участника ${label}`}
                      >
                        <option value="editor">Редактор</option>
                        <option value="viewer">Только просмотр</option>
                      </Select>
                    </form>
                  ) : (
                    <span
                      className={[
                        "inline-flex items-center h-7 px-2.5 rounded-full text-[0.78rem] font-semibold",
                        m.role === "owner"
                          ? "bg-accent-soft text-accent-dark"
                          : "bg-[#F4F4F1] text-muted",
                      ].join(" ")}
                    >
                      {ROLE_LABEL_RU[m.role]}
                    </span>
                  )}
                  {canManageThis ? (
                    <form
                      action={removeMember}
                      onSubmit={confirmAndProceed(
                        `Удалить ${label} из проекта?`,
                      )}
                    >
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <Button type="submit" variant="danger" size="sm">
                        Убрать
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {isOwner ? (
          <form
            action={inviteAction}
            className="mt-6 pt-6 border-t border-line grid gap-3"
            noValidate
          >
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-muted">
              Пригласить участника
            </p>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid sm:grid-cols-[2fr_1fr] gap-3">
              <label className="grid gap-1.5">
                <span className="text-[0.82rem] font-medium text-muted">
                  Email
                </span>
                <Input name="email" type="email" required autoComplete="off" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[0.82rem] font-medium text-muted">
                  Роль
                </span>
                <Select name="role" defaultValue="editor" required>
                  <option value="editor">Редактор</option>
                  <option value="viewer">Только просмотр</option>
                </Select>
              </label>
            </div>
            {inviteState.status === "error" && inviteState.message ? (
              <p
                role="alert"
                className="rounded-control border border-danger/20 bg-[#FBEAE7] text-danger text-[0.93rem] leading-snug px-3.5 py-2.5"
              >
                {inviteState.message}
              </p>
            ) : null}
            {inviteState.status === "success" && inviteState.message ? (
              <p
                role="status"
                className="rounded-control border border-[#F8D4C5] bg-accent-soft text-accent-dark text-[0.93rem] leading-snug px-3.5 py-2.5"
              >
                {inviteState.message}
              </p>
            ) : null}
            <div>
              <Button type="submit" variant="primary" size="md" disabled={invitePending}>
                {invitePending ? "Приглашаем…" : "Пригласить"}
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      {/* === Share link === */}
      {canEdit ? (
        <Card className="!p-6">
          <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] text-ink mb-1">
            Публичная ссылка
          </h2>
          {shareToken ? (
            <>
              <p className="text-[0.92rem] text-muted leading-snug mb-4">
                У кого есть эта ссылка — увидит результат расчёта (итоговую
                сумму и переводы). Деталей платежей и личных данных там нет.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <Input
                  id="share-link-input"
                  type="text"
                  readOnly
                  value={shareUrl || `…/share/${shareToken}`}
                  onFocus={(event) => event.currentTarget.select()}
                  className="font-mono text-[0.82rem]"
                />
                <Button
                  type="button"
                  onClick={copyShareUrl}
                  variant="primary"
                  size="md"
                  disabled={!shareUrl}
                >
                  {shareCopied ? (
                    <>
                      <Check size={16} aria-hidden="true" />
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} aria-hidden="true" />
                      <span>Скопировать</span>
                    </>
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <form
                  action={enableShare}
                  onSubmit={confirmAndProceed(
                    "Создать новую ссылку? Старая перестанет работать.",
                  )}
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <Button type="submit" variant="secondary" size="sm">
                    Создать новую ссылку
                  </Button>
                </form>
                <form
                  action={disableShare}
                  onSubmit={confirmAndProceed("Отключить публичный доступ?")}
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <Button type="submit" variant="danger" size="sm">
                    Отключить
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p className="text-[0.92rem] text-muted leading-snug mb-4">
                Создайте ссылку, чтобы поделиться итогом расчёта с теми, у кого
                нет аккаунта.
              </p>
              <form action={enableShare}>
                <input type="hidden" name="projectId" value={projectId} />
                <Button type="submit" variant="primary" size="md">
                  Создать публичную ссылку
                </Button>
              </form>
            </>
          )}
        </Card>
      ) : null}

      {/* === Danger zone === */}
      <Card className="!p-6 !border-danger/20 !bg-[#FBEAE7]/30">
        <h2 className="text-[1.15rem] font-bold tracking-[-0.01em] text-danger mb-4">
          Опасная зона
        </h2>

        {mustTransferBeforeLeaving ? (
          <div>
            <p className="text-[0.92rem] text-muted leading-snug mb-4">
              Вы единственный владелец проекта. Передайте права другому
              участнику — после этого сможете покинуть проект.
            </p>
            <form
              action={transferOwnership}
              className="grid gap-3"
              onSubmit={(event) => {
                const select = event.currentTarget.elements.namedItem(
                  "toUserId",
                ) as HTMLSelectElement | null;
                const selectedId = select?.value ?? "";
                const target = otherMembers.find(
                  (m) => m.user_id === selectedId,
                );
                const targetLabel = target ? memberLabel(target) : "участнику";
                if (
                  !window.confirm(
                    `Передать права владения участнику «${targetLabel}»? ` +
                      "Вы станете редактором.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="projectId" value={projectId} />
              <label className="grid gap-1.5">
                <span className="text-[0.82rem] font-medium text-muted">
                  Новый владелец
                </span>
                <Select name="toUserId" required defaultValue="">
                  <option value="" disabled>
                    Выберите участника
                  </option>
                  {otherMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {memberLabel(m)}
                    </option>
                  ))}
                </Select>
              </label>
              <div>
                <Button type="submit" variant="primary" size="md">
                  Передать права
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <form
            action={leaveProject}
            onSubmit={confirmAndProceed(
              members.length === 1
                ? "Вы единственный участник — выход из проекта удалит его безвозвратно. Точно покинуть?"
                : "Покинуть проект? Вы потеряете к нему доступ.",
            )}
          >
            <input type="hidden" name="projectId" value={projectId} />
            <p className="text-[0.92rem] text-muted leading-snug mb-4">
              {members.length === 1
                ? "Если вы покинете проект — он будет удалён, потому что других участников нет."
                : "Вы выйдете из проекта. Доступ можно будет вернуть только через нового владельца."}
            </p>
            <Button type="submit" variant="danger" size="md">
              Покинуть проект
            </Button>
          </form>
        )}

        {isOwner ? (
          <>
            <hr className="border-0 border-t border-danger/20 my-6" />
            <p className="text-[0.92rem] text-muted leading-snug mb-4">
              Удаление проекта — все участники потеряют доступ, история стирается
              безвозвратно.
            </p>
            <form
              action={deleteProject}
              onSubmit={confirmAndProceed(
                "Удалить проект безвозвратно? Это нельзя отменить.",
              )}
            >
              <input type="hidden" name="id" value={projectId} />
              <Button type="submit" variant="danger" size="md">
                Удалить проект
              </Button>
            </form>
          </>
        ) : null}
      </Card>
    </>
  );
}
