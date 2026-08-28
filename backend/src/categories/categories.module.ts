import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Category, CategorySchema } from './schemas/category.schema.js';
import {
  AttributeDefinition,
  AttributeDefinitionSchema,
} from './schemas/attribute-definition.schema.js';
import { CategoriesService } from './categories.service.js';
import { CategoriesController } from './categories.controller.js';
import { AttributeDefinitionsService } from './attribute-definitions.service.js';
import { AttributeDefinitionsController } from './attribute-definitions.controller.js';
import { AiModule } from '../ai/ai.module.js';
import {
  ProductListing,
  ProductListingSchema,
} from '../listings/schemas/product-listing.schema.js';
import { SearchModule } from '../search/search.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: AttributeDefinition.name, schema: AttributeDefinitionSchema },
      // Registered so deleting a category can move its listings to the parent.
      { name: ProductListing.name, schema: ProductListingSchema },
    ]),
    forwardRef(() => AiModule),
    forwardRef(() => SearchModule),
  ],
  controllers: [CategoriesController, AttributeDefinitionsController],
  providers: [CategoriesService, AttributeDefinitionsService],
  exports: [CategoriesService, AttributeDefinitionsService, MongooseModule],
})
export class CategoriesModule {}
