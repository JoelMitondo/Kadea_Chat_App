import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'inscriptions.store': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'New_compte.register': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'inscriptions.store': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}