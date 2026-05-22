"use client";

import {
  useActionState,
  useEffect,
  useState,
  type FormEvent,
} from "react";
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
      <section className="placeholder-panel">
        <h2>Участники ({members.length})</h2>

        <ul className="members-list">
          {members.map((m) => {
            const label = memberLabel(m);
            const isMe = m.user_id === currentUserId;
            const canManageThis = isOwner && !isMe && m.role !== "owner";

            return (
              <li key={m.user_id} className="members-item">
                <div className="members-info">
                  <strong>
                    {label}
                    {isMe ? " (вы)" : ""}
                  </strong>
                  {m.email && m.email !== label ? (
                    <span className="meta">{m.email}</span>
                  ) : null}
                </div>
                <div className="members-row-actions">
                  {canManageThis ? (
                    <form action={changeRole}>
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="userId" value={m.user_id} />
                      <select
                        name="role"
                        defaultValue={m.role}
                        onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        className="text-input compact-select members-role"
                        aria-label={`Роль участника ${label}`}
                      >
                        <option value="editor">Редактор</option>
                        <option value="viewer">Только просмотр</option>
                      </select>
                    </form>
                  ) : (
                    <span className={`members-role-label members-role-${m.role}`}>
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
                      <button
                        type="submit"
                        className="ghost-button danger members-remove"
                      >
                        Убрать
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {isOwner ? (
          <form action={inviteAction} className="invite-form" noValidate>
            <p className="eyebrow">Пригласить участника</p>
            <input type="hidden" name="projectId" value={projectId} />
            <div className="invite-fields">
              <label className="field">
                <span className="field-label">Email</span>
                <input
                  className="text-input"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span className="field-label">Роль</span>
                <select
                  name="role"
                  className="text-input compact-select"
                  defaultValue="editor"
                  required
                >
                  <option value="editor">Редактор</option>
                  <option value="viewer">Только просмотр</option>
                </select>
              </label>
            </div>
            {inviteState.status === "error" && inviteState.message ? (
              <p className="auth-banner auth-banner-error">
                {inviteState.message}
              </p>
            ) : null}
            {inviteState.status === "success" && inviteState.message ? (
              <p className="auth-banner auth-banner-success">
                {inviteState.message}
              </p>
            ) : null}
            <button
              type="submit"
              className="primary-button"
              disabled={invitePending}
            >
              {invitePending ? "Приглашаем…" : "Пригласить"}
            </button>
          </form>
        ) : null}
      </section>

      {canEdit ? (
        <section className="placeholder-panel">
          <h2>Публичная ссылка</h2>
          {shareToken ? (
            <>
              <p>
                У кого есть эта ссылка — увидит результат расчёта (итоговую
                сумму и переводы). Деталей платежей и личных данных там нет.
              </p>
              <div className="share-link-row">
                <input
                  id="share-link-input"
                  className="text-input share-link-input"
                  type="text"
                  readOnly
                  value={shareUrl || `…/share/${shareToken}`}
                  onFocus={(event) => event.currentTarget.select()}
                />
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="primary-button"
                  disabled={!shareUrl}
                >
                  {shareCopied ? "Скопировано" : "Скопировать"}
                </button>
              </div>
              <div className="share-actions">
                <form
                  action={enableShare}
                  onSubmit={confirmAndProceed(
                    "Создать новую ссылку? Старая перестанет работать.",
                  )}
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <button type="submit" className="ghost-button">
                    Создать новую ссылку
                  </button>
                </form>
                <form
                  action={disableShare}
                  onSubmit={confirmAndProceed("Отключить публичный доступ?")}
                >
                  <input type="hidden" name="projectId" value={projectId} />
                  <button type="submit" className="ghost-button danger">
                    Отключить
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <p>
                Создайте ссылку, чтобы поделиться итогом расчёта с теми, у кого
                нет аккаунта.
              </p>
              <form action={enableShare}>
                <input type="hidden" name="projectId" value={projectId} />
                <button type="submit" className="primary-button">
                  Создать публичную ссылку
                </button>
              </form>
            </>
          )}
        </section>
      ) : null}

      <section className="placeholder-panel danger-zone">
        <h2>Опасная зона</h2>

        {mustTransferBeforeLeaving ? (
          <>
            <p>
              Вы единственный владелец проекта. Передайте права другому
              участнику — после этого сможете покинуть проект.
            </p>
            <form
              action={transferOwnership}
              className="transfer-form"
              onSubmit={(event) => {
                const select = (event.currentTarget.elements.namedItem(
                  "toUserId",
                ) as HTMLSelectElement | null);
                const selectedId = select?.value ?? "";
                const target = otherMembers.find((m) => m.user_id === selectedId);
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
              <label className="field">
                <span className="field-label">Новый владелец</span>
                <select
                  name="toUserId"
                  className="text-input"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Выберите участника
                  </option>
                  {otherMembers.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {memberLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="primary-button">
                Передать права
              </button>
            </form>
          </>
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
            <p>
              {members.length === 1
                ? "Если вы покинете проект — он будет удалён, потому что других участников нет."
                : "Вы выйдете из проекта. Доступ можно будет вернуть только через нового владельца."}
            </p>
            <button
              type="submit"
              className="ghost-button danger hero-button"
            >
              Покинуть проект
            </button>
          </form>
        )}

        {isOwner ? (
          <>
            <hr className="account-divider" />
            <p>
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
              <button
                type="submit"
                className="ghost-button danger hero-button"
              >
                Удалить проект
              </button>
            </form>
          </>
        ) : null}
      </section>
    </>
  );
}
