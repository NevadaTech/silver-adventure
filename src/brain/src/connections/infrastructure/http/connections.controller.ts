import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { DeleteConnectionAction } from '@/connections/application/use-cases/DeleteConnectionAction'
import {
  GetUserConnections,
  type GetUserConnectionsResult,
} from '@/connections/application/use-cases/GetUserConnections'
import {
  RecordConnectionAction,
  type RecordConnectionActionResult,
} from '@/connections/application/use-cases/RecordConnectionAction'
import {
  isConnectionAction,
  type ConnectionAction,
} from '@/connections/domain/value-objects/ConnectionAction'

interface RecordRequest {
  userId?: string
  recommendationId?: string
  action?: string
  note?: string | null
}

interface RecordResponse {
  connection: {
    id: string
    userId: string
    recommendationId: string
    action: ConnectionAction
    note: string | null
    createdAt: string
  }
}

@ApiTags('connections')
@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly recordConnection: RecordConnectionAction,
    private readonly deleteConnection: DeleteConnectionAction,
    private readonly getUserConnections: GetUserConnections,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Record (upsert) a user action on a recommendation',
  })
  async record(@Body() body: RecordRequest = {}): Promise<RecordResponse> {
    const userId = body.userId?.trim() ?? ''
    const recommendationId = body.recommendationId?.trim() ?? ''
    const action = body.action?.trim() ?? ''
    if (userId.length === 0) {
      throw new BadRequestException('userId is required')
    }
    if (recommendationId.length === 0) {
      throw new BadRequestException('recommendationId is required')
    }
    if (!isConnectionAction(action)) {
      throw new BadRequestException(
        `Invalid action. Expected one of: marked, saved, dismissed, simulated_contact`,
      )
    }

    let result: RecordConnectionActionResult
    try {
      result = await this.recordConnection.execute({
        userId,
        recommendationId,
        action,
        note: body.note ?? null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      if (message.startsWith('Recommendation not found')) {
        throw new NotFoundException(message)
      }
      throw e
    }

    const c = result.connection
    return {
      connection: {
        id: c.id,
        userId: c.userId,
        recommendationId: c.recommendationId,
        action: c.action,
        note: c.note,
        createdAt: c.createdAt.toISOString(),
      },
    }
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a user action from a recommendation' })
  async remove(
    @Query('userId') userId: string | undefined,
    @Query('recommendationId') recommendationId: string | undefined,
    @Query('action') action: string | undefined,
  ): Promise<void> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('userId query param is required')
    }
    if (!recommendationId || recommendationId.trim().length === 0) {
      throw new BadRequestException('recommendationId query param is required')
    }
    if (!action || !isConnectionAction(action)) {
      throw new BadRequestException(
        'action query param must be one of: marked, saved, dismissed, simulated_contact',
      )
    }

    await this.deleteConnection.execute({
      userId: userId.trim(),
      recommendationId: recommendationId.trim(),
      action,
    })
  }
}

@ApiTags('connections')
@Controller('users')
export class UserConnectionsController {
  constructor(private readonly getUserConnections: GetUserConnections) {}

  @Get(':userId/connections')
  @ApiOperation({ summary: 'List connections recorded by a user' })
  async list(
    @Param('userId') userId: string,
  ): Promise<GetUserConnectionsResult> {
    if (!userId || userId.trim().length === 0) {
      throw new BadRequestException('userId is required')
    }
    return this.getUserConnections.execute({ userId: userId.trim() })
  }
}
