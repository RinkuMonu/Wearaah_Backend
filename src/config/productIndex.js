import client from "./elasticsearch.js";


export const createVariantProductIndex = async () => {
    const exists = await client.indices.exists({ index: "variants" });

    if (!exists) {
        try {
            await client.indices.create({
                index: "variants",

                // 🔥 ADD THIS (IMPORTANT)
                settings: {
                    analysis: {
                        filter: {
                            my_synonym_filter: {
                                type: "synonym",
                                synonyms: [
                                    "men, mens, male",
                                    "tshirt, t shirt, tee",
                                    "jeans, denim"
                                ]
                            }
                        },
                        analyzer: {
                            my_analyzer: {
                                tokenizer: "standard",
                                filter: [
                                    "lowercase",
                                    "asciifolding",
                                    "my_synonym_filter"
                                ]
                            }
                        }
                    }
                },

                mappings: {
                    properties: {
                        name: {
                            type: "text",
                            analyzer: "my_analyzer",
                            fields: {
                                keyword: { type: "keyword" },
                                suggest: {
                                    type: "search_as_you_type",
                                    analyzer: "my_analyzer"
                                }
                            }
                        },
                        keywords: {
                            type: "text",
                            analyzer: "my_analyzer",
                            fields: {
                                keyword: { type: "keyword" },
                                suggest: {
                                    type: "search_as_you_type",
                                    analyzer: "my_analyzer"
                                }
                            }
                        },
                        description: {
                            type: "text",
                            analyzer: "my_analyzer"
                        },
                        brand: { type: "keyword" },
                        category: { type: "keyword" },
                        SubCategory: { type: "keyword" },
                        color: { type: "keyword" },
                        size: { type: "keyword" },
                        price: { type: "float" },
                        rating: { type: "float" }
                    }
                }
            });
            console.log("✅ Index created");
        } catch (error) {
            console.error("❌ Index creation error:", error.message);
        }

    }
};


// index create function for product variant 

export const indexVariant = async (variant, product) => {
    console.log("Indexing variant:", variant);
    console.log("Indexing product:", product);
    try {
        await client.index({
            index: "variants",
            id: variant._id.toString(),
            document: {
                variantId: variant._id,
                productId: product._id,

                name: product.name,
                keywords: product.keywords || [],
                description: product.description,
                brand: product.brandId?.name || "",
                category: product.categoryId?.name || "",
                SubCategory: product.subCategoryId?.name || "",
                // attributes: product.subCategoryId?.attributes || {},

                color: variant.color,
                size: variant.size,
                rating: product.rating || 0
            }
        });

        console.log("✅ Variant indexed in Elastic");
    } catch (error) {
        console.error("❌ Indexing error:", error.message);
    }
};