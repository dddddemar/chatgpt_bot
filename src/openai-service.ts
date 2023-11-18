import { fetchEventSource } from "@microsoft/fetch-event-source";
import axios from "axios";
import { encode } from "gpt-token-utils";
import {
  ChatCompletionRequestMessage,
  CreateChatCompletionRequest,
  ListModelsResponse,
} from "openai";

type Role = "user" | "assistant" | "system";

interface CreateChatCompletionDeltaResponse {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: [
    {
      delta: {
        role: Role;
        content?: string;
      };
      index: number;
      finish_reason: string | null;
    }
  ];
}

type OpenAIServiceOptions = Omit<
  CreateChatCompletionRequest,
  "stream" | "messages"
>;

class OpenAIService {
  private _apiKey?: string;
  private _defaultOptions: OpenAIServiceOptions;
  private _abortController: AbortController = new AbortController();
  private static _currentSendingInstance: OpenAIService | null = null;

  constructor(
    apiKey?: string,
    defalutOptions: OpenAIServiceOptions = { model: "gpt-3.5-turbo" }
  ) {
    this._apiKey = apiKey;
    this._defaultOptions = defalutOptions;
    this._abortController.abort();
  }

  public checkApiKey() {
    if (!this._apiKey) throw new Error("ChatGPT Error: API key is not set");
  }

  public async setApiKey(apiKey: string) {
    this._apiKey = apiKey;
  }

  public async setOptions(options: OpenAIServiceOptions) {
    this._defaultOptions = options;
  }

  public async getModels() {
    this.checkApiKey();
    try {
      const response = await axios.get("https://api.openai.com/v1/models", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._apiKey}`,
        },
      });
      const data = response.data as ListModelsResponse;
      const models = data.data.map((model) => model.id);
      return models;
    } catch (err) {
      console.error(
        "request faild with error,maybe you provide incorrect key: ",
        err
      );
    }
  }

  public calculateToken(message: string) {
    return encode(message).length;
  }

  public async requestChatCompletion(
    requestBody: CreateChatCompletionRequest,
    onMessage: (
      message: string,
      steamResponse: CreateChatCompletionDeltaResponse
    ) => void
  ) {
    if (OpenAIService._currentSendingInstance !== null)
      throw new Error("ChatGPT Error: There is already a request in progress");
    this.checkApiKey();

    OpenAIService._currentSendingInstance = this;
    this._abortController = new AbortController();

    try {
      const message: string[] = [];
      if (requestBody.stream !== true) requestBody.stream = true;
      // https://cfcus02.opapi.win/v1/chat/completions
      await fetchEventSource("https://cfcus02.opapi.win/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this._apiKey}`,
        },
        body: JSON.stringify(requestBody),
        onopen: async (response) => {
          console.log("ChatGPT: connection opened");
        },
        onmessage: (event) => {
          if (event.data === "[DONE]") return;
          const data = JSON.parse(
            event.data
          ) as CreateChatCompletionDeltaResponse;

          if (data.choices[0].finish_reason === "stop") {
            this._abortController.abort();
          } else {
            message.push(data.choices[0].delta.content || "");
            onMessage(message.join(""), data);
          }
        },
        onerror: (err) => {
          throw err;
        },
        signal: this._abortController.signal,
      });

      return message.join("");
    } catch (err) {
      console.error("ChatGPT Error: request faild", err);
    } finally {
      OpenAIService._currentSendingInstance = null;
    }
  }

  public async sendMessage(
    message: string,
    onMessage: (
      message: string,
      streamResponse: CreateChatCompletionDeltaResponse
    ) => void,
    system?: string[],
    options?: Partial<OpenAIServiceOptions>
  ) {
    const historyPrompt = system ? `History:\n${system.join("\n")}\n\n` : "";
    const result = await this.requestChatCompletion(
      {
        messages: [
          {
            role: "system",
            content: historyPrompt,
          },
          {
            role: "user",
            content: message,
          },
        ],
        stream: true,
        ...this._defaultOptions,
        ...options,
      },
      onMessage
    );

    return result;
  }

  public async sendMessages(
    messages: ChatCompletionRequestMessage[],
    onMessage: (
      message: string,
      streamResponse: CreateChatCompletionDeltaResponse
    ) => void
  ) {
    const result = await this.requestChatCompletion(
      {
        messages: messages,
        stream: true,
        ...this._defaultOptions,
      },
      onMessage
    );

    return result;
  }

  public abort() {
    if (OpenAIService._currentSendingInstance !== this)
      throw new Error("ChatGPT Error: There is no request in progress");
    if (this._abortController.signal.aborted) return;
    this._abortController.abort();
  }
}

const openaiService = new OpenAIService();

openaiService.setApiKey("sk-AOAnW4paa680Fb44E2a6T3BlBKFJbb3158070508409e8f96");

export { openaiService };
