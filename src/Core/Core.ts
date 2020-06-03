import {createHmac} from 'crypto';
import {Options} from 'request';
import {stringify as qsStringify} from 'querystring';
import {parse as xmlParser} from 'fast-xml-parser';
import {IApi, IHeaders, IAccess, ISeller, ISetting, TMethod, TArea, IArea} from './CoreTypes';
import {defaultAccess, defaultSeller} from './Env';
import {CreateArea, sortObject, sleepSecond, Requesting, isArray, hasKeyObject} from './CoreHelpers';
import {
  ConfigurationError,
  LocalExceededError,
  QuotaExceeded,
  RequestThrottled,
  RequestTimeoutError,
  UndefinedRequestError,
} from './CoreErrors';

export class Api implements IApi {
  Path?: string;
  Version?: string;
  Method?: TMethod;
  Action?: string;
  Setting?: ISetting;
  Headers?: IHeaders;
  Area: IArea;
  Access: IAccess;
  Seller: ISeller;

  constructor(seller: ISeller, access?: IAccess) {
    this.Access = {...defaultAccess, ...access};
    if (!this.Access.AWSAccessKeyId || !this.Access.AWSAccessSecret) {
      throw new ConfigurationError('Access[AWSAccessKeyId] or Access[AWSAccessSecret] not configured');
    }

    this.Seller = {...defaultSeller, ...seller};
    if (!this.Seller.SellerId || !this.Seller.MWSAuthToken) {
      throw new ConfigurationError('Seller[SellerId] or Seller[MWSAuthToken] not empty');
    }

    const areas = ['BR', 'CA', 'MX', 'AE', 'DE', 'ES', 'FR', 'GB', 'IN', 'IT', 'TR', 'AU', 'JP', 'CN', 'US'];
    if (!areas.includes(this.Seller.Area)) {
      throw new ConfigurationError(`Seller[Area] not in [${areas.join(',')}]`);
    }
    this.Area = CreateArea(this.Seller.Area);
  }


  public ConfigureArea(area: TArea = 'US'): void {
    this.Area = CreateArea(area);
  }

  public GetArea(area: TArea = 'US'): IArea {
    return CreateArea(area);
  }

  public ConfigureSeller(seller: ISeller): void {
    this.Seller = {...defaultSeller, ...seller};
    this.Area = CreateArea(this.Seller.Area || 'US');
  }

  public async SleepSecond(second): Promise<void> {
    await sleepSecond(second);
  }

  public CreateOptions(params: Record<string, any>, parsing?: Record<string, any>): Options {
    if (hasKeyObject(parsing)) {
      const assign = {};
      for (const key of Object.keys(parsing)) {
        const prefix = parsing[key];
        const arrays = params[key] as any[];
        if (isArray(arrays)) {
          arrays.forEach((val, inx) => assign[`${prefix}${inx + 1}`] = val);
          delete params[key];
        }
      }
      params = {...params, ...assign};
    }

    const {
      Path, Method, Action, Version, Headers,
      Area: {Host},
      Seller: {SellerId, MWSAuthToken},
      Setting: {IsMerchant},
      Access: {AWSAccessKeyId, AWSAccessSecret}
    } = this;
    const Timestamp = (new Date()).toISOString();
    const RemotePath = `/${Path}/${Version}`;
    const PreParams = {Action, AWSAccessKeyId, MWSAuthToken, Timestamp, Version, ...params} as Record<string, any>;
    PreParams.SignatureMethod = 'HmacSHA256';
    PreParams.SignatureVersion = '2';
    IsMerchant ? PreParams.Merchant = SellerId : PreParams.SellerId = SellerId;
    PreParams.Signature = createHmac('sha256', AWSAccessSecret)
      .update([Method, Host, RemotePath, qsStringify(sortObject(PreParams))].join('\n'))
      .digest('base64');

    Headers.Host = Host;
    if (Method === 'POST') {
      Headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const PreOptions: Options = {
      method: Method,
      url: `https://${Host}/${RemotePath}`,
      headers: Headers,
    };
    if (Method === 'GET') {
      PreOptions.qs = PreParams;
    } else {
      PreOptions.form = PreParams;
    }

    return PreOptions;
  }

  public async CreateRequest(options: Options): Promise<any> {
    const {Convert, Retrying, Timeout, Throttled} = this.Setting;

    for (let i = 0; i < Retrying + 1; i++) {
      try {
        const body = await Requesting(options);
        if (Convert === 'XML') {
          return body;
        } else {
          return this.CreateResponse(body);
        }
      } catch (error) {
        if (error instanceof RequestTimeoutError) {
          // timeout
        } else if (error instanceof QuotaExceeded) {
          // quota exceeded
          await this.SleepSecond(60 * 60);
        } else if (error instanceof RequestThrottled) {
          // request throttled
          await sleepSecond(Throttled);
        } else {
          throw error;
        }
      }
    }

    throw new LocalExceededError();
  }

  public CreateResponse(body: any): any {
    const {Action} = this;
    const res = xmlParser(body, {ignoreNameSpace: true, parseTrueNumberOnly: true}) as any;
    if (res.ErrorResponse) {
      throw new UndefinedRequestError();
    } else {
      return res[`${Action}Response`][`${Action}Result`];
    }
  }
}
