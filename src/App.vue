<template>
  <div class="chat-container">
    <div
      v-for="message in messages"
      :key="message.id"
      :class="['message', message.role]"
    >
      <p>{{ message.content }}</p>
    </div>
    <input v-model="userInput" @keydown.enter="sendMessage" class="input-box" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { openaiService } from "./openai-service";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
}

const userInput = ref("");
const messages = ref<Message[]>([]);

async function sendMessage() {
  const userMessage = userInput.value.trim();
  if (userMessage === "") return;

  // 添加用户消息到界面
  messages.value.push({
    id: Date.now(),
    role: "user",
    content: userMessage,
  });

  // 调用OpenAI服务发送消息
  await openaiService.sendMessage(userMessage, handleMessage);

  // 清空用户输入
  userInput.value = "";
}

function handleMessage(
  message: string,
  streamResponse: CreateChatCompletionDeltaResponse
) {
  // 清空之前的回复
  messages.value = [];

  // 添加机器人的回复到界面
  messages.value.push({
    id: Date.now(),
    role: "assistant",
    content: message,
  });
}
</script>
<style scoped>
.chat-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
  border: 1px solid #ccc;
  border-radius: 5px;
  background-color: #f7f7f7;
}
.message {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 5px;
}
.user {
  background-color: #e3f2fd;
  text-align: right;
}
.assistant {
  background-color: #f5f5f5;
  text-align: left;
}
.input-box {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
}
</style>
