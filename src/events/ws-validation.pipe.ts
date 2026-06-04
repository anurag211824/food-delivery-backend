import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WsException } from '@nestjs/websockets';

/**
 * WebSocket-specific validation pipe.
 * Unlike the HTTP ValidationPipe, this throws WsException instead of BadRequestException,
 * which properly propagates errors back through the socket channel.
 */
@Injectable()
export class WsValidationPipe implements PipeTransform {
    async transform(value: any, { metatype }: ArgumentMetadata) {
        if (!metatype || !this.shouldValidate(metatype)) {
            return value;
        }

        const object = plainToInstance(metatype, value);
        const errors = await validate(object, {
            whitelist: true,
            forbidNonWhitelisted: true,
        });

        if (errors.length > 0) {
            const messages = errors
                .map(err => Object.values(err.constraints || {}).join(', '))
                .join('; ');
            throw new WsException(`Validation failed: ${messages}`);
        }

        return object;
    }

    private shouldValidate(metatype: Function): boolean {
        const types: Function[] = [String, Boolean, Number, Array, Object];
        return !types.includes(metatype);
    }
}
