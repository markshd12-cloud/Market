/** Comando para rodar o Albion Data Client só contra o NYX (nada vai para a API pública). */
export const captureCommand = (baseUrl: string, key: string) =>
  `albiondata-client.exe -i "${baseUrl}/api/capture/${key}"`;
