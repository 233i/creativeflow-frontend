"use client";

import Image from "next/image";
import { useState } from "react";
import { Alert, Button, Card, Form, Input, type SubmitContext } from "tdesign-react";
import * as adminApi from "@/features/admin/api";

interface LoginFormData {
  username: string;
  password: string;
}

/** 管理员登录拥有独立会话；不能与普通用户认证合并。 */
export function AdminLogin({
  onAuthenticated,
}: {
  onAuthenticated: (admin: adminApi.AdminIdentity) => void;
}) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit({ validateResult }: SubmitContext) {
    setError(null);
    if (validateResult !== true) return;

    const values = form.getFieldsValue(true) as LoginFormData;
    setSubmitting(true);
    try {
      const result = await adminApi.login(values.username, values.password);
      if (!result.admin) throw new Error("管理员身份返回为空");
      onAuthenticated(result.admin);
    } catch (reason) {
      setError(
        reason instanceof adminApi.AdminApiError && reason.status === 401
          ? "管理员账号或密码错误"
          : reason instanceof Error
            ? reason.message
            : "登录失败",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sol-admin-login">
      <Card className="sol-admin-login-card" bordered>
        <div className="sol-admin-login-heading">
          <div className="sol-admin-login-icon">
            <Image src="/favicon.png" alt="" width={28} height={28} priority />
          </div>
          <h1>CreativeFlow 管理后台</h1>
          <p>使用管理员账号登录后继续</p>
        </div>

        <Form
          className="sol-admin-login-form"
          form={form}
          initialData={{ username: "admin", password: "" }}
          labelAlign="top"
          requiredMark
          rules={{
            username: [{ required: true, message: "请输入管理员账号", trigger: "submit" }],
            password: [{ required: true, message: "请输入管理员密码", trigger: "submit" }],
          }}
          onSubmit={(context) => void submit(context)}
        >
          <Form.FormItem className="sol-admin-login-field" label="管理员账号" name="username">
            <Input size="large" autocomplete="username" autofocus clearable />
          </Form.FormItem>
          <Form.FormItem
            className="sol-admin-login-field sol-admin-login-field-last"
            label="密码"
            name="password"
          >
            <Input
              size="large"
              type="password"
              autocomplete="current-password"
              placeholder="请输入管理员密码"
              clearable
            />
          </Form.FormItem>
          <div className="sol-admin-login-actions">
            <div className="sol-admin-login-action-stack">
              {error && <Alert theme="error" message={error} closeBtn={false} />}
              <Button type="submit" theme="primary" size="large" block loading={submitting}>
                登录
              </Button>
            </div>
          </div>
        </Form>
      </Card>
    </div>
  );
}
