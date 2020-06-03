import request, {Options, Response} from 'request';
import {IArea, IObject, TArea} from './CoreTypes';
import {
  AccessDenied,
  InputStreamDisconnected,
  InternalError,
  InvalidAccessKeyId,
  InvalidAddress,
  InvalidParameterValue,
  LocalRequestError,
  QuotaExceeded,
  RequestThrottled,
  RequestTimeoutError,
  SignatureDoesNotMatch,
  UndefinedRequestError,
} from './CoreErrors';


export const isUndefined = (val: any): boolean => {
  return typeof val === 'undefined';
};

export const isNil = (val: any): boolean => {
  return isUndefined(val) || val === null;
};

export const isString = (val: any): boolean => {
  return typeof val === 'string';
};

export const isObject = (val: any): boolean => {
  return !isNil(val) && typeof val === 'object';
};

export const isArray = (val: any): boolean => {
  return Array.isArray(val);
};

export const isFunction = (val: any): boolean => {
  return typeof val === 'function';
};

export const isEmptyObject = (val: any): boolean => {
  return isObject(val) && !isArray(val) && Object.keys(val).length === 0;
};

export const hasKeyObject = (val: any): boolean => {
  return isObject(val) && !isArray(val) && Object.keys(val).length > 0;
};

export const sortObject = (obj: { [key: string]: any }): IObject => {
  return Object.keys(obj).sort().reduce((all, key) => {
    if (!isNil(obj[key])) {
      all[key] = obj[key];
    }
    return all;
  }, {});
};

export const splitArray = (arr: any[], size: number): any[] => {
  const rs = [];
  const ts = [...arr];
  for (let i = 0; i < ts.length; i = i + size) {
    rs.push(ts.slice(i, i + size));
  }
  return rs;
};

export const sleepSecond = (second: number = 1): Promise<null> => {
  return new Promise((resolve) => setTimeout(resolve, second * 1000));
};

export const listTakeOffLayer = (key: string, ct: any): any => {
  if (!/(^List)|(List$)/.test(key)) {
    return ct;
  }
  const sub = Object.keys(ct)[0];

  if (isArray(ct[sub])) {
    return ct[sub];
  } else {
    return [ct[sub]];
  }
};

export function CreateArea(area: TArea): IArea {
  const areas = {
    BR: {Id: 'A2Q3Y263D00KWC', Host: 'mws.amazonservices.com'},
    CA: {Id: 'A2EUQ1WTGCTBG2', Host: 'mws.amazonservices.ca'},
    MX: {Id: 'A1AM78C64UM0Y8', Host: 'mws.amazonservices.com.mx'},
    AE: {Id: 'A2VIGQ35RCS4UG', Host: 'mws.amazonservices.ae'},
    DE: {Id: 'A1PA6795UKMFR9', Host: 'mws-eu.amazonservices.com'},
    ES: {Id: 'A1RKKUPIHCS9HS', Host: 'mws-eu.amazonservices.com'},
    FR: {Id: 'A13V1IB3VIYZZH', Host: 'mws-eu.amazonservices.com'},
    GB: {Id: 'A1F83G8C2ARO7P', Host: 'mws-eu.amazonservices.com'},
    IN: {Id: 'A21TJRUUN4KGV', Host: 'mws.amazonservices.in'},
    IT: {Id: 'APJ6JRA9NG5V4', Host: 'mws-eu.amazonservices.com'},
    TR: {Id: 'A33AVAJ2PDY3EV', Host: 'mws-eu.amazonservices.com'},
    AU: {Id: 'A39IBJ37TRP1C6', Host: 'mws.amazonservices.com.au'},
    JP: {Id: 'A1VC38T7YXB528', Host: 'mws.amazonservices.jp'},
    CN: {Id: 'AAHKV2X7AFYLW', Host: 'mws.amazonservices.com.cn'},
    US: {Id: 'ATVPDKIKX0DER', Host: 'mws.amazonservices.com'},
  };
  return areas[area];
}

export function Requesting(options: Options): Promise<any> {
  return new Promise((resolve, reject) => {
    request(options, (error: any, resp: Response, body: any) => {
      if (error && (error.code === 'ESOCKETTIMEDOUT' || error.code === 'ETIMEDOUT')) {
        return reject(new RequestTimeoutError());
      } else if (error) {
        return reject(new LocalRequestError());
      } else if (resp.statusCode === 400 && /InputStreamDisconnected/.test(body)) {
        return reject(new InputStreamDisconnected(resp));
      } else if (resp.statusCode === 400 && /InvalidParameterValue/.test(body)) {
        return reject(new InvalidParameterValue(resp));
      } else if (resp.statusCode === 401 && /AccessDenied/.test(body)) {
        return reject(new AccessDenied(resp));
      } else if (resp.statusCode === 403 && /InvalidAccessKeyId/.test(body)) {
        return reject(new InvalidAccessKeyId(resp));
      } else if (resp.statusCode === 403 && /SignatureDoesNotMatch/.test(body)) {
        return reject(new SignatureDoesNotMatch(resp));
      } else if (resp.statusCode === 404 && /InvalidAddress/.test(body)) {
        return reject(new InvalidAddress(resp));
      } else if (resp.statusCode === 500 && /InternalError/.test(body)) {
        return reject(new InternalError(resp));
      } else if (resp.statusCode === 503 && /QuotaExceeded/.test(body)) {
        return reject(new QuotaExceeded(resp));
      } else if (resp.statusCode === 503 && /RequestThrottled/.test(body)) {
        return reject(new RequestThrottled(resp));
      } else if (/<ErrorResponse.*>[\s\S]*<\/ErrorResponse>/.test(body)) {
        return reject(new UndefinedRequestError(resp));
      } else {
        return resolve(body);
      }
    });
  });
}

