import { Message } from "whatsapp-web.js";
import { promiseTracker } from "../clients/prompt";
import { sydney } from "../clients/sydney";
import { config } from "../config";

async function handleIncomingMessageImpl(message: Message) {
  const chat = await message.getChat();
  const prompt = message.body;

  chat.sendSeen();

  const sydneyResponse = await promiseTracker.track(prompt, chat, askSydney(prompt, chat.id._serialized));
  console.log("Sydney's response: ", sydneyResponse.response);

  await message.reply(sydneyResponse.response);
  chat.clearState();
}

async function askSydney(prompt: string, chatId: string) {
  let options: IOptions = {
    toneStyle: config.toneStyle,
    jailbreakConversationId: chatId,
    onProgress: (token: string) => {
      process.stdout.write(token);
    }
  };

  const onGoingConversation = await sydney.conversationsCache.get(chatId);

  if (onGoingConversation) {
    const [{ parentMessageId }] = onGoingConversation.messages.slice(-1);
    options.parentMessageId = parentMessageId;
  }

  const response = await sydney.sendMessage(prompt, options);
  return response;
}

// generated by GPT-4, this ensures the typing indicator will last more than 25s
function typingIndicatorWrapper(fn: (message: Message) => Promise<void>) {
  return async (message: Message) => {
    const chat = await message.getChat();
    let interval: NodeJS.Timeout = setTimeout(() => {}, 0);

    const typingIndicator = () => {
      chat.sendStateTyping();
      interval = setTimeout(typingIndicator, 25000);
    };

    typingIndicator();

    try {
      const result = await fn(message);
      clearTimeout(interval);
      return result;
    } catch (error) {
      clearTimeout(interval);
      throw error;
    }
  };
}

export const handleIncomingMessage = typingIndicatorWrapper(handleIncomingMessageImpl);

interface IOptions {
  toneStyle: typeof config.VALID_TONES[number];
  systemMessage?: string;
  jailbreakConversationId?: string;
  parentMessageId?: string;
  onProgress?: (token: string) => void;
}
