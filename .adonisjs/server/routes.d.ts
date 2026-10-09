import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
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
    'messages': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'profile': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'forgotPassword.get': { paramsTuple?: []; params?: {} }
    'forgo_passwords.index_page_new_password': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'messages': { paramsTuple?: []; params?: {} }
    'profile': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'forgotPassword.get': { paramsTuple?: []; params?: {} }
    'forgo_passwords.index_page_new_password': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'messages': { paramsTuple?: []; params?: {} }
    'profile': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'inscriptions.store': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.store': { paramsTuple?: []; params?: {} }
    'forgoPassword.post': { paramsTuple?: []; params?: {} }
    'forgot_password.reset': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'code': ParamValue} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'profile.update': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}