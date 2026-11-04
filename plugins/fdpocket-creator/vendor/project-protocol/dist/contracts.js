import { z } from 'zod';
import { aiResetResponse, aiTurnEvent, aiTurnResult } from "./ai.js";
import { bridgeOpMessage, contextMessage, contextUpdateMessage, helloMessage, initMessage, replyMessage, } from "./bridge.js";
import { connectionCallResult, connectionGrantResult } from "./connections.js";
import { errorResponse } from "./errors.js";
import { jobCancelResponse, jobScheduleResponse } from "./jobs.js";
import { notificationSendResponse, notificationStatusResponse } from "./notifications.js";
import { platformProfileResponse } from "./profile.js";
import { pythonRun, pythonRunFinished } from "./python.js";
import { safetyBlocksResponse } from "./safety.js";
import { storageAbortResponse, storageBeginResponse, storageCompleteResponse, storageDeleteResponse, storageDownloadResponse, storageFile, storageSignPartsResponse, } from "./storage.js";
import { projectTokenClaims, serviceTokenClaims, serviceTokenResponse, session, sessionApp, tokenExchangeRequest, tokenExchangeResponse, } from "./token.js";
import { userInvitation, userInvitationResult, userInvitationsResponse, } from "./user-invitations.js";
import { workspace, workspaceInvitation, workspaceInvitationCreated, workspaceInvitationsResponse, workspaceMembership, } from "./workspaces.js";
/**
 * 凍結する契約の一覧（contract-compatibility.md §4.1）。公開済みのミニアプリ・ネイティブアプリと
 * Platform が通信で交わす形のうち、`contract()` で定義したものすべて。
 *
 * - `read`: Platform が書き、凍結された側が読む（応答・context・claims・event）
 * - `write`: 凍結された側が書き、Platform が読む（hello・op・exchange のリクエスト）
 *
 * ここに足し忘れると凍結の対象にならないので、`contracts.test.ts` が「`contract()` で定義した
 * 公開の名前はすべてここにある」ことを確かめる。
 */
export const CONTRACTS = {
    'ai.resetResponse': { contract: aiResetResponse, direction: 'read' },
    'ai.turnEvent': { contract: aiTurnEvent, direction: 'read' },
    'ai.turnResult': { contract: aiTurnResult, direction: 'read' },
    'bridge.context': { contract: contextMessage, direction: 'read' },
    'bridge.contextUpdate': { contract: contextUpdateMessage, direction: 'read' },
    'bridge.hello': { contract: helloMessage, direction: 'write' },
    'bridge.init': { contract: initMessage, direction: 'read' },
    'bridge.op': { contract: bridgeOpMessage, direction: 'write' },
    'bridge.reply': { contract: replyMessage, direction: 'read' },
    'connections.callResult': { contract: connectionCallResult, direction: 'read' },
    'connections.grantResult': { contract: connectionGrantResult, direction: 'read' },
    'error.response': { contract: errorResponse, direction: 'read' },
    'jobs.cancelResponse': { contract: jobCancelResponse, direction: 'read' },
    'jobs.scheduleResponse': { contract: jobScheduleResponse, direction: 'read' },
    'notifications.sendResponse': { contract: notificationSendResponse, direction: 'read' },
    'notifications.statusResponse': { contract: notificationStatusResponse, direction: 'read' },
    'profile.response': { contract: platformProfileResponse, direction: 'read' },
    'python.run': { contract: pythonRun, direction: 'read' },
    'python.runFinished': { contract: pythonRunFinished, direction: 'read' },
    'safety.blocksResponse': { contract: safetyBlocksResponse, direction: 'read' },
    'storage.abortResponse': { contract: storageAbortResponse, direction: 'read' },
    'storage.beginResponse': { contract: storageBeginResponse, direction: 'read' },
    'storage.completeResponse': { contract: storageCompleteResponse, direction: 'read' },
    'storage.deleteResponse': { contract: storageDeleteResponse, direction: 'read' },
    'storage.downloadResponse': { contract: storageDownloadResponse, direction: 'read' },
    'storage.file': { contract: storageFile, direction: 'read' },
    'storage.signPartsResponse': { contract: storageSignPartsResponse, direction: 'read' },
    'token.claims': { contract: projectTokenClaims, direction: 'read' },
    'token.exchangeRequest': { contract: tokenExchangeRequest, direction: 'write' },
    'token.exchangeResponse': { contract: tokenExchangeResponse, direction: 'read' },
    'token.serviceClaims': { contract: serviceTokenClaims, direction: 'read' },
    'token.serviceResponse': { contract: serviceTokenResponse, direction: 'read' },
    'token.session': { contract: session, direction: 'read' },
    'token.sessionApp': { contract: sessionApp, direction: 'read' },
    'users.invitation': { contract: userInvitation, direction: 'read' },
    'users.invitationResult': { contract: userInvitationResult, direction: 'read' },
    'users.invitations': { contract: userInvitationsResponse, direction: 'read' },
    'workspaces.invitation': { contract: workspaceInvitation, direction: 'read' },
    'workspaces.invitationCreated': { contract: workspaceInvitationCreated, direction: 'read' },
    'workspaces.invitations': { contract: workspaceInvitationsResponse, direction: 'read' },
    'workspaces.membership': { contract: workspaceMembership, direction: 'read' },
    'workspaces.workspace': { contract: workspace, direction: 'read' },
};
/** 契約の JSON Schema（書く側の形 = `exact`。未知のキー・値を拒む形を凍結する） */
export function jsonSchemaOf(name) {
    return z.toJSONSchema(CONTRACTS[name].contract.exact, {
        target: 'draft-2020-12',
        io: 'output',
        unrepresentable: 'any',
    });
}
/** 全契約の JSON Schema（名前順。凍結ファイルの中身） */
export function frozenSchemas() {
    return Object.fromEntries(Object.keys(CONTRACTS)
        .sort()
        .map((name) => [name, { direction: CONTRACTS[name].direction, schema: jsonSchemaOf(name) }]));
}
