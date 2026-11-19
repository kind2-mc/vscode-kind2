// The version of the protocol between this extension and the Kind 2 language
// server. Before changing it, see "Protocol versions" in the README of the
// kind2-language-server repository.
export const KIND2_PROTOCOL_VERSION = 1;

// Sent to the server in the initialize request, so that it can reject an
// extension it no longer supports with a clear message.
export const initializationOptions = {
  kind2ProtocolVersion: KIND2_PROTOCOL_VERSION
};
