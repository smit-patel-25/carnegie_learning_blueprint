import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(72, "Password must be 72 characters or fewer.");

export const onboardingRoleSchema = z.enum(["student", "teacher", "parent"], {
  error: "Choose student, teacher, or parent.",
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required."),
});

export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Confirm your password."),
    role: onboardingRoleSchema,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z.object({
  email: emailField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type OnboardingRole = z.infer<typeof onboardingRoleSchema>;
