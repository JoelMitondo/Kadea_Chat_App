import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'health_checks.ping': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'inscriptions.store': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'forgotPassword.get': { paramsTuple?: []; params?: {} }
    'forgoPassword.post': { paramsTuple?: []; params?: {} }
    'forgo_passwords.index_page_new_password': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'forgot_password.reset': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'profile': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'messages': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'conversations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users': { paramsTuple?: []; params?: {} }
    'users.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'settings.delete': { paramsTuple?: []; params?: {} }
    'groups': { paramsTuple?: []; params?: {} }
    'groups.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.store': { paramsTuple?: []; params?: {} }
    'groups.members.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'realtime.unread': { paramsTuple?: []; params?: {} }
    'realtime.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'settings': { paramsTuple?: []; params?: {} }
    'settings.password': { paramsTuple?: []; params?: {} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.unblock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'search': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'health_checks.ping': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'forgotPassword.get': { paramsTuple?: []; params?: {} }
    'forgo_passwords.index_page_new_password': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'profile': { paramsTuple?: []; params?: {} }
    'messages': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users': { paramsTuple?: []; params?: {} }
    'groups': { paramsTuple?: []; params?: {} }
    'groups.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'realtime.unread': { paramsTuple?: []; params?: {} }
    'settings': { paramsTuple?: []; params?: {} }
    'search': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'health_checks.ping': { paramsTuple?: []; params?: {} }
    'home': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'forgotPassword.get': { paramsTuple?: []; params?: {} }
    'forgo_passwords.index_page_new_password': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'profile': { paramsTuple?: []; params?: {} }
    'messages': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users': { paramsTuple?: []; params?: {} }
    'groups': { paramsTuple?: []; params?: {} }
    'groups.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'realtime.unread': { paramsTuple?: []; params?: {} }
    'settings': { paramsTuple?: []; params?: {} }
    'search': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'inscriptions.store': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.store': { paramsTuple?: []; params?: {} }
    'forgoPassword.post': { paramsTuple?: []; params?: {} }
    'forgot_password.reset': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.chat': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'settings.delete': { paramsTuple?: []; params?: {} }
    'groups.store': { paramsTuple?: []; params?: {} }
    'groups.members.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'realtime.read': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'settings.password': { paramsTuple?: []; params?: {} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.unblock': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'conversations.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'groups.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'messages.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}