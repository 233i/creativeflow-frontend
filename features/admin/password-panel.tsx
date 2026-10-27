"use client";

import { Alert, Button, Card, Form, Input, Space, type SubmitContext } from "tdesign-react";
import { useState } from "react";
import * as adminApi from "@/features/admin/api";
import { useWorkspaceGuard } from "@/components/providers/workspace-context";

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof adminApi.AdminApiError) {
    if (reason.status === 401) return "管理员会话已失效，请重新登录";
    if (reason.message === "invalid_current_password") return "当前密码不正确";
    if (reason.message === "invalid_new_password") return "新密码必须为 10–128 个字符";
    return reason.details[0] ?? reason.message;
  }

  return reason instanceof Error ? reason.message : "修改密码失败";
}

export function PasswordPanel({
  username,
  onChanged,
}: {
  username: string;
  onChanged: () => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit({ validateResult }: SubmitContext) {
    setMessage(null);
    if (validateResult !== true) return;

    const values = form.getFieldsValue(true) as PasswordFormData;
    setSubmitting(true);
    try {
      await adminApi.changePassword(values.currentPassword, values.newPassword);
      form.reset({ type: "empty" });
      setDirty(false);
      setMessage({ ok: true, text: "管理员密码已更新，请使用新密码登录。" });
      onChanged();
    } catch (reason) {
      setMessage({ ok: false, text: errorMessage(reason) });
    } finally {
      setSubmitting(false);
    }
  }

  useWorkspaceGuard({
    dirty,
    busy: submitting,
    message: dirty ? "密码输入只保存在当前页签，请在原页面确认修改。" : undefined,
  });

  return (
    <section className="sol-admin-panel">
      <header className="sol-admin-panel-header">
        <div>
          <h2 className="text-base font-semibold">修改管理员密码</h2>
          <p className="mt-1 text-sm text-[var(--td-text-color-secondary)]">
            修改成功后，默认密码将立即失效。
          </p>
        </div>
      </header>

      <div className="sol-admin-panel-scroll">
        <Card
          className="max-w-xl"
          title="登录密码"
          description="新密码长度为 10–128 个字符"
          headerBordered
        >
          <Form
            form={form}
            labelAlign="top"
            requiredMark
            scrollToFirstError="smooth"
            rules={{
              currentPassword: [{ required: true, message: "请输入当前密码", trigger: "submit" }],
              newPassword: [
                { required: true, message: "请输入新密码", trigger: "submit" },
                {
                  validator: (value) =>
                    typeof value === "string" && value.length >= 10 && value.length <= 128,
                  message: "新密码必须为 10–128 个字符",
                  trigger: "submit",
                },
              ],
              confirmPassword: [
                { required: true, message: "请再次输入新密码", trigger: "submit" },
                {
                  validator: (value) => value === form.getFieldValue("newPassword"),
                  message: "两次输入的新密码不一致",
                  trigger: "submit",
                },
              ],
            }}
            onSubmit={(context) => void submit(context)}
            onValuesChange={(_, values) => setDirty(Object.values(values).some(Boolean))}
          >
            <input
              className="sr-only"
              type="text"
              name="username"
              value={username}
              autoComplete="username"
              tabIndex={-1}
              readOnly
              aria-hidden
            />
            <Form.FormItem label="当前密码" name="currentPassword">
              <Input
                type="password"
                autocomplete="current-password"
                placeholder="请输入当前管理员密码"
                clearable
              />
            </Form.FormItem>

            <Form.FormItem label="新密码" name="newPassword">
              <Input
                type="password"
                autocomplete="new-password"
                placeholder="至少 10 个字符"
                maxlength={128}
                clearable
              />
            </Form.FormItem>

            <Form.FormItem label="确认新密码" name="confirmPassword">
              <Input
                type="password"
                autocomplete="new-password"
                placeholder="再次输入新密码"
                maxlength={128}
                clearable
              />
            </Form.FormItem>

            <Form.FormItem className="pt-5">
              <Space direction="vertical" size="small" className="w-full">
                {message && (
                  <Alert
                    theme={message.ok ? "success" : "error"}
                    message={message.text}
                    closeBtn={false}
                  />
                )}
                <Button type="submit" theme="primary" loading={submitting}>
                  保存新密码
                </Button>
              </Space>
            </Form.FormItem>
          </Form>
        </Card>
      </div>
    </section>
  );
}
