import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail, verificationEmail } from "@/lib/email";

export const VERIFICATION_TOKEN_TTL_HOURS = 24;

/** Only the SHA-256 hash is stored; the raw token travels in the email link. */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a fresh token for the email (invalidating previous ones) and sends the link. */
export async function sendVerificationEmail(
  user: { name: string | null; email: string },
  origin: string,
) {
  const token = randomBytes(32).toString("hex");

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: user.email } }),
    prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token: hashToken(token),
        expires: new Date(
          Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
        ),
      },
    }),
  ]);

  const verifyUrl = `${origin}/verificar-correo?token=${token}`;
  const { subject, html } = verificationEmail(user.name, verifyUrl);
  await sendEmail({ to: user.email, subject, html });
}

export type VerifyEmailResult = "verified" | "already-verified" | "invalid";

/** Consumes a raw token from the email link and marks the user as verified. */
export async function verifyEmailToken(
  rawToken: string,
): Promise<VerifyEmailResult> {
  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });
  if (!record || record.expires < new Date()) return "invalid";

  const user = await prisma.user.findUnique({
    where: { email: record.identifier },
    select: { id: true, emailVerified: true },
  });

  await prisma.verificationToken.delete({ where: { token: record.token } });

  if (!user) return "invalid";
  if (user.emailVerified) return "already-verified";

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });
  return "verified";
}
