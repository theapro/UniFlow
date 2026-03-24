import { ChatSender } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class ChatService {
  async listSessions(userId: string) {
    return prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createSession(userId: string, title: string) {
    return prisma.chatSession.create({
      data: { userId, title },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async renameSession(userId: string, sessionId: string, title: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return null;

    return prisma.chatSession.update({
      where: { id: sessionId },
      data: { title },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteSession(userId: string, sessionId: string) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return false;

    await prisma.chatSession.delete({ where: { id: sessionId } });
    return true;
  }

  async getSession(userId: string, sessionId: string) {
    return prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async bumpSession(sessionId: string) {
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });
  }

  async listMessages(userId: string, sessionId: string, limit: number) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) return null;

    const rows = await prisma.chat.findMany({
      where: { sessionId, userId },
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        sender: true,
        message: true,
        timestamp: true,
      },
    });

    return rows.reverse();
  }

  async addMessage(params: {
    userId: string;
    sessionId: string;
    sender: ChatSender;
    message: string;
  }) {
    const session = await prisma.chatSession.findFirst({
      where: { id: params.sessionId, userId: params.userId },
      select: { id: true },
    });
    if (!session) return null;

    const row = await prisma.chat.create({
      data: {
        userId: params.userId,
        sessionId: params.sessionId,
        sender: params.sender,
        message: params.message,
      },
      select: {
        id: true,
        sender: true,
        message: true,
        timestamp: true,
      },
    });

    await this.bumpSession(params.sessionId);

    return row;
  }
}
