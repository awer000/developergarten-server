import Joi, { SchemaLike } from 'joi';
import { Request, Response } from 'express'

export function normalize<T>(
  array: T[],
  selector: (item: T) => string | number = (item: any) => item.id
) {
  const object: {
    [key: string]: T;
  } = {};
  array.forEach(item => {
    object[selector(item)] = item;
  });
  return object;
}

export function groupById<T>(order: string[], data: T[], idResolver: (row: T) => string) {
  const map: {
    [key: string]: T[];
  } = {};
  // creates array for every key
  order.forEach(id => {
    map[id] = [];
  });
  data.forEach(row => {
    map[idResolver(row)].push(row);
  });
  const ordered = order.map(id => map[id]);
  return ordered;
}

/***
 * Validates Request Body with Joi
 */
export const validateBody = (req: Request, res: Response, schema: SchemaLike) => {
  const validation = Joi.validate(req.body, schema);
  if (validation.error) {
    res.status(400);
    res.json({
      name: 'WRONG_SCHEMA',
      payload: validation.error
    });
    return false;
  }
  return true;
};

export const escapeForUrl = (text: string): string => {
  return text
    .replace(
      /[^0-9a-zA-Zㄱ-힣.\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf -]/g,
      ''
    )
    .trim()
    .replace(/ /g, '-')
    .replace(/--+/g, '-');
};

export function checkEmpty(text: string) {
  if (!text) return true;
  const replaced = text
    .trim()
    .replace(/([\u3164\u115F\u1160\uFFA0\u200B\u0001-\u0008\u000B-\u000C\u000E-\u001F]+)/g, '')
    .replace(/&nbsp;/, '');
  if (replaced === '') return true;
  return false;
}
